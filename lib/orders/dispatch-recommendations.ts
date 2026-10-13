import "server-only";

import { OrderProductionStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { suggestDispatchBatches } from "@/lib/orders/batching";
import { signRouteSuggestionEvidence } from "@/lib/orders/route-evidence";
import {
  DeterministicScenarioPlan,
  FakeRoutingProvider,
} from "@/lib/providers/fakes";
import { GoogleRoutesProvider } from "@/lib/providers/google-routing";

export async function getControllerDispatchRecommendations(now = new Date()) {
  const [settings, drivers, orders] = await Promise.all([
    db.restaurantOrderSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    }),
    db.driver.findMany({
      where: {
        isActive: true,
        shifts: {
          some: {
            isActive: true,
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
        },
      },
      include: {
        zoneEligibilities: {
          where: { isActive: true },
          select: { deliveryZoneId: true },
        },
        deliveryRuns: {
          where: {
            status: {
              in: ["APPROVED", "READY", "PICKED_UP", "EN_ROUTE"],
            },
          },
          select: { id: true, status: true, plannedDepartureAt: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.order.findMany({
      where: {
        paymentStatus: "PAID",
        productionStatus: OrderProductionStatus.AT_DISPATCH_DESK,
        dispatchStatus: "UNASSIGNED",
        deliveryStops: {
          none: {
            status: {
              in: [
                "PLANNED",
                "BAG_VERIFIED",
                "PICKED_UP",
                "EN_ROUTE",
                "ARRIVED",
              ],
            },
          },
        },
        deliveryLatitude: { not: null },
        deliveryLongitude: { not: null },
        deliveryZoneIdSnapshot: { not: null },
        atDispatchDeskAt: { not: null },
        dispatchDeadlineAt: { not: null },
      },
      orderBy: [{ dispatchDeadlineAt: "asc" }, { atDispatchDeskAt: "asc" }],
    }),
  ]);

  if (
    settings.restaurantLatitude === null ||
    settings.restaurantLongitude === null
  ) {
    return {
      recommendations: [],
      issue: "Restaurant coordinates are missing.",
    };
  }

  const env = getEnv();
  const provider =
    env.GEOCODING_PROVIDER === "google" && env.GOOGLE_MAPS_API_KEY
      ? new GoogleRoutesProvider(env.GOOGLE_MAPS_API_KEY)
      : new FakeRoutingProvider(
          new DeterministicScenarioPlan({
            "routing.orderStops": ["terminal_failure"],
          }),
        );

  const recommendations = [];
  for (const driver of drivers) {
    if (driver.deliveryRuns.length > 0) continue;
    const eligibleZones = new Set(
      driver.zoneEligibilities.map((entry) => entry.deliveryZoneId),
    );
    if (eligibleZones.size === 0) continue;
    const candidates = orders.filter(
      (order) =>
        order.deliveryZoneIdSnapshot &&
        eligibleZones.has(order.deliveryZoneIdSnapshot),
    );
    if (candidates.length === 0) continue;
    const suggestions = await suggestDispatchBatches(
      candidates.map((order) => ({
        id: order.id,
        zoneId: order.deliveryZoneIdSnapshot!,
        atDeskAt: order.atDispatchDeskAt!,
        dispatchDeadlineAt: order.dispatchDeadlineAt!,
        latitude: order.deliveryLatitude!,
        longitude: order.deliveryLongitude!,
      })),
      {
        maxWaitMinutes: settings.dispatchMaxWaitMinutes,
        deadlineBufferMinutes: settings.dispatchDeadlineBufferMinutes,
        lowDemandReleaseCount: settings.dispatchLowDemandReleaseCount,
      },
      provider,
      {
        id: "restaurant",
        latitude: settings.restaurantLatitude,
        longitude: settings.restaurantLongitude,
      },
      now,
    );
    for (const suggestion of suggestions) {
      const orderNumbers = suggestion.orderIds.map(
        (id) => orders.find((order) => order.id === id)!.orderNumber,
      );
      const urgent = suggestion.reasons.includes("deadline-risk");
      const waitMinutes = urgent
        ? 0
        : Math.max(
            0,
            Math.min(
              settings.dispatchMaxWaitMinutes,
              Math.floor(
                Math.min(
                  ...suggestion.orderIds.map(
                    (id) =>
                      (orders.find((order) => order.id === id)!
                        .dispatchDeadlineAt!.getTime() -
                        now.getTime()) /
                      60_000,
                  ),
                ) - settings.dispatchDeadlineBufferMinutes,
              ),
            ),
          );
      const instruction = waitMinutes > 0
          ? `Hold up to ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}, then send with ${driver.name}.`
          : `Send now with ${driver.name}.`;
      recommendations.push({
        ...suggestion,
        driver: { id: driver.id, name: driver.name },
        orderNumbers,
        waitMinutes,
        instruction,
        evidenceToken: signRouteSuggestionEvidence({
          driverId: driver.id,
          orderIds: suggestion.orderIds,
          explanation: suggestion.explanation,
          routingStatus: suggestion.routingStatus,
          durationSeconds: suggestion.durationSeconds,
          distanceMeters: suggestion.distanceMeters,
        }),
      });
    }
  }

  recommendations.sort((a, b) => {
    const aUrgent = a.reasons.includes("deadline-risk") ? 0 : 1;
    const bUrgent = b.reasons.includes("deadline-risk") ? 0 : 1;
    return (
      aUrgent - bUrgent ||
      a.waitMinutes - b.waitMinutes ||
      b.orderIds.length - a.orderIds.length ||
      a.driver.name.localeCompare(b.driver.name)
    );
  });
  return { recommendations, issue: null };
}
