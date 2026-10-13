import type { RoutingProvider } from "@/lib/providers/contracts";

export type BatchCandidate = {
  id: string;
  zoneId: string;
  atDeskAt: Date;
  dispatchDeadlineAt: Date;
  latitude: number;
  longitude: number;
};

export async function suggestDispatchBatches(
  orders: BatchCandidate[],
  policy: { maxWaitMinutes: number; deadlineBufferMinutes: number; lowDemandReleaseCount: number },
  routing: RoutingProvider,
  origin: { id: string; latitude: number; longitude: number },
  now = new Date(),
) {
  const byZone = new Map<string, BatchCandidate[]>();
  for (const order of orders) byZone.set(order.zoneId, [...(byZone.get(order.zoneId) ?? []), order]);
  const suggestions = [];
  for (const [zoneId, zoneOrders] of byZone) {
    const sorted = [...zoneOrders].sort((a, b) =>
      a.dispatchDeadlineAt.getTime() - b.dispatchDeadlineAt.getTime() ||
      a.atDeskAt.getTime() - b.atDeskAt.getTime() ||
      a.id.localeCompare(b.id),
    );
    while (sorted.length) {
      const batch = sorted.splice(0, 4);
      const oldestWait = Math.max(...batch.map((order) => now.getTime() - order.atDeskAt.getTime())) / 60_000;
      const deadlineMinutes = Math.min(...batch.map((order) => order.dispatchDeadlineAt.getTime() - now.getTime())) / 60_000;
      const reasons = [
        ...(batch.length === 4 ? ["capacity"] : []),
        ...(oldestWait >= policy.maxWaitMinutes ? ["oldest-wait"] : []),
        ...(deadlineMinutes <= policy.deadlineBufferMinutes ? ["deadline-risk"] : []),
        ...(zoneOrders.length <= policy.lowDemandReleaseCount ? ["low-demand"] : []),
      ];
      if (reasons.length === 0) continue;
      const route = await routing.orderStops(origin, batch.map((order) => ({ id: order.id, latitude: order.latitude, longitude: order.longitude })));
      const routed = route.kind === "success";
      suggestions.push({
        zoneId,
        orderIds: routed ? route.value.orderedStopIds : batch.map((order) => order.id),
        reasons,
        routingStatus: routed ? ("ROUTED" as const) : ("MANUAL_FALLBACK" as const),
        durationSeconds: routed ? route.value.durationSeconds : null,
        distanceMeters: routed ? route.value.distanceMeters : null,
        routingIssue: routed ? null : route.kind === "duplicate" ? "Provider returned a duplicate result." : `${route.error.code}: ${route.error.message}`,
        explanation: `Hard constraints: same zone, desk-ready, max four. Release: ${reasons.join(", ")}.${routed ? " Stops ordered by the routing provider." : " Routing unavailable; preserve the displayed deterministic order and verify manually."}`,
      });
    }
  }
  return suggestions;
}
