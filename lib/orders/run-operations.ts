import { randomInt } from "node:crypto";
import {
  DeliveryRunStatus,
  DeliveryStopStatus,
  OrderActorType,
  OrderDispatchStatus,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderProductionStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { withSerializableRetry } from "@/lib/db-transactions";

export class RunOperationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RunOperationError";
  }
}
type Actor = { id: string; label?: string };
const activeRunStatuses = [
  DeliveryRunStatus.DRAFT,
  DeliveryRunStatus.APPROVED,
  DeliveryRunStatus.READY,
  DeliveryRunStatus.PICKED_UP,
  DeliveryRunStatus.EN_ROUTE,
  DeliveryRunStatus.EXCEPTION,
];
const runNumber = () =>
  `RUN-${Date.now().toString(36).toUpperCase()}-${randomInt(36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0")}`;
const ROUTED_DELIVERY_BUFFER_SECONDS = 10 * 60;

export function composePickupDeliveryWindow(pickedUpAt: Date, estimatedDurationSeconds: number | null) {
  if (estimatedDurationSeconds === null) return null;
  return { startAt: pickedUpAt, endAt: new Date(pickedUpAt.getTime() + (estimatedDurationSeconds + ROUTED_DELIVERY_BUFFER_SECONDS) * 1000) };
}

async function eligibleDriver(
  tx: Prisma.TransactionClient,
  driverId: string,
  zoneIds: string[],
  now: Date,
) {
  const driver = await tx.driver.findFirst({
    where: {
      id: driverId,
      isActive: true,
      shifts: {
        some: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      },
    },
    include: { zoneEligibilities: { where: { isActive: true } } },
  });
  if (
    !driver ||
    zoneIds.some(
      (zoneId) =>
        !driver.zoneEligibilities.some(
          (eligibility) => eligibility.deliveryZoneId === zoneId,
        ),
    )
  ) {
    throw new RunOperationError(
      "DRIVER_INELIGIBLE",
      "Driver is inactive, off shift, or not eligible for every run zone.",
    );
  }
  return driver;
}

export async function createOperationalRun(
  client: PrismaClient,
  input: {
    requestKey: string;
    orderIds: string[];
    driverId: string;
    allowCrossZone?: boolean;
    overrideReason?: string;
    routePlan?: {
      explanation: string;
      routingStatus: "ROUTED" | "MANUAL_FALLBACK" | "MANUAL_SELECTION";
      durationSeconds?: number | null;
      distanceMeters?: number | null;
    };
    actor: Actor;
  },
) {
  const distinct = [...new Set(input.orderIds)];
  if (
    distinct.length !== input.orderIds.length ||
    distinct.length < 1 ||
    distinct.length > 4
  )
    throw new RunOperationError(
      "RUN_CAPACITY_INVALID",
      "A run requires one to four distinct orders.",
    );
  return withSerializableRetry(client, async (tx) => {
    const existing = await tx.deliveryRun.findUnique({
      where: { requestKey: input.requestKey },
      include: { stops: { orderBy: { position: "asc" } } },
    });
    if (existing) {
      const same =
        existing.driverId === input.driverId &&
        existing.stops.length === distinct.length &&
        existing.stops.every((stop, index) => stop.orderId === distinct[index]);
      if (!same)
        throw new RunOperationError(
          "IDEMPOTENCY_CONFLICT",
          "Run request key was reused with different input.",
        );
      return existing;
    }
    const orders = await tx.order.findMany({
      where: { id: { in: distinct } },
      include: {
        driverAssignment: true,
        deliveryStops: {
          where: { run: { status: { in: activeRunStatuses } } },
          select: { id: true },
        },
      },
    });
    if (orders.length !== distinct.length)
      throw new RunOperationError(
        "ORDER_NOT_FOUND",
        "Every run order must exist.",
      );
    if (
      orders.some(
        (order) =>
          order.paymentStatus !== OrderPaymentStatus.PAID ||
          order.productionStatus !== OrderProductionStatus.AT_DISPATCH_DESK ||
          !order.deliveryZoneIdSnapshot,
      )
    )
      throw new RunOperationError(
        "ORDER_NOT_DESK_READY",
        "Every order must be paid, packed, and at the dispatch desk with a zone snapshot.",
      );
    if (orders.some((order) => order.deliveryStops.length))
      throw new RunOperationError(
        "ORDER_ALREADY_ASSIGNED",
        "An order already has an active run assignment.",
      );
    if (
      orders.some(
        (order) =>
          order.driverAssignment &&
          !["CANCELLED", "DELIVERED"].includes(order.driverAssignment.status),
      )
    )
      throw new RunOperationError(
        "LEGACY_ASSIGNMENT_ACTIVE",
        "Remove the legacy direct driver assignment before creating a delivery run.",
      );
    const zones = [
      ...new Set(orders.map((order) => order.deliveryZoneIdSnapshot!)),
    ];
    if (
      zones.length > 1 &&
      (!input.allowCrossZone || !input.overrideReason?.trim())
    )
      throw new RunOperationError(
        "CROSS_ZONE_FORBIDDEN",
        "Cross-zone runs require an explicit dispatcher override reason.",
      );
    const now = new Date();
    const driver = await eligibleDriver(tx, input.driverId, zones, now);
    const first = orders[0]!;
    const run = await tx.deliveryRun.create({
      data: {
        requestKey: input.requestKey,
        runNumber: runNumber(),
        status: DeliveryRunStatus.APPROVED,
        zoneIdSnapshot:
          zones.length === 1
            ? first.deliveryZoneIdSnapshot!
            : "cross-zone-override",
        zoneNameSnapshot:
          zones.length === 1
            ? (first.deliveryZoneNameSnapshot ?? first.deliveryZoneIdSnapshot!)
            : "Cross-zone override",
        driverId: driver.id,
        crossZoneOverride: zones.length > 1,
        overrideReason: input.overrideReason?.trim(),
        routeExplanation:
          input.routePlan?.explanation ??
          "Dispatcher manually selected desk-ready orders; server hard constraints were applied.",
        routingStatus: input.routePlan?.routingStatus ?? "MANUAL_SELECTION",
        estimatedDurationSeconds: input.routePlan?.durationSeconds ?? null,
        estimatedDistanceMeters: input.routePlan?.distanceMeters ?? null,
        approvedByActorId: input.actor.id,
        approvedByActorLabel: input.actor.label,
        approvedAt: now,
        stops: {
          create: distinct.map((orderId, index) => ({
            orderId,
            position: index + 1,
          })),
        },
      },
      include: { stops: { orderBy: { position: "asc" } } },
    });
    await tx.order.updateMany({
      where: { id: { in: distinct } },
      data: { dispatchStatus: OrderDispatchStatus.RUN_PLANNED, fulfillmentStatus: OrderFulfillmentStatus.DRIVER_ASSIGNED },
    });
    await tx.orderEvent.createMany({
      data: distinct.map((orderId) => ({
        orderId,
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: "DELIVERY_RUN_APPROVED",
        fromFulfillmentStatus: orders.find((order) => order.id === orderId)!.fulfillmentStatus,
        toFulfillmentStatus: OrderFulfillmentStatus.DRIVER_ASSIGNED,
        fromDispatchStatus: OrderDispatchStatus.UNASSIGNED,
        toDispatchStatus: OrderDispatchStatus.RUN_PLANNED,
        metadata: {
          runId: run.id,
          overrideReason: input.overrideReason ?? null,
          routeExplanation: run.routeExplanation,
          routingStatus: run.routingStatus,
          estimatedDurationSeconds: run.estimatedDurationSeconds,
          estimatedDistanceMeters: run.estimatedDistanceMeters,
        },
      })),
    });
    return run;
  });
}

export async function verifyRunBag(
  client: PrismaClient,
  input: { runId: string; orderId: string; actor: Actor },
) {
  return withSerializableRetry(client, async (tx) => {
    const run = await tx.deliveryRun.findUnique({
      where: { id: input.runId },
      include: { stops: true },
    });
    if (
      !run ||
      (run.status !== DeliveryRunStatus.APPROVED &&
        run.status !== DeliveryRunStatus.READY)
    )
      throw new RunOperationError(
        "RUN_NOT_BAGGABLE",
        "Run is not awaiting bag verification.",
      );
    const stop = run.stops.find(
      (candidate) => candidate.orderId === input.orderId,
    );
    if (!stop)
      throw new RunOperationError(
        "STOP_NOT_FOUND",
        "Order is not in this run.",
      );
    if (stop.status === DeliveryStopStatus.BAG_VERIFIED) return stop;
    const updated = await tx.deliveryStop.update({
      where: { id: stop.id },
      data: {
        status: DeliveryStopStatus.BAG_VERIFIED,
        bagVerifiedAt: new Date(),
        bagVerifiedBy: input.actor.id,
      },
    });
    const remaining = await tx.deliveryStop.count({
      where: { runId: run.id, status: { in: [DeliveryStopStatus.PLANNED] } },
    });
    await tx.order.update({
      where: { id: input.orderId },
      data: { dispatchStatus: OrderDispatchStatus.READY_FOR_PICKUP },
    });
    if (remaining === 0)
      await tx.deliveryRun.update({
        where: { id: run.id },
        data: { status: DeliveryRunStatus.READY },
      });
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: "RUN_BAG_VERIFIED",
        fromDispatchStatus: OrderDispatchStatus.RUN_PLANNED,
        toDispatchStatus: OrderDispatchStatus.READY_FOR_PICKUP,
        metadata: { runId: run.id },
      },
    });
    return updated;
  });
}

/**
 * Records the physical bag-to-driver transfer and dispatches the complete run.
 * Planning a run never changes customer truth; only this command moves orders
 * to On the way. Repeated submissions return the already-dispatched run.
 */
export async function confirmRunHandoff(
  client: PrismaClient,
  input: { runId: string; actor: Actor; now?: Date },
) {
  const now = input.now ?? new Date();
  return withSerializableRetry(client, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "DeliveryRun" WHERE "id" = ${input.runId} FOR UPDATE`;
    const run = await tx.deliveryRun.findUnique({
      where: { id: input.runId },
      include: {
        stops: {
          orderBy: { position: "asc" },
          include: { order: true },
        },
      },
    });
    if (!run)
      throw new RunOperationError("RUN_NOT_FOUND", "Delivery run not found.");
    if (run.handedOffAt) return run;
    if (
      !run.driverId ||
      !new Set<DeliveryRunStatus>([
        DeliveryRunStatus.APPROVED,
        DeliveryRunStatus.READY,
      ]).has(run.status)
    ) {
      throw new RunOperationError(
        "RUN_NOT_HANDOFF_READY",
        "The run is not ready for physical handoff.",
      );
    }
    const activeStops = run.stops.filter(
      (stop) => stop.status !== DeliveryStopStatus.CANCELLED,
    );
    if (activeStops.length < 1 || activeStops.length > 4)
      throw new RunOperationError(
        "RUN_CAPACITY_INVALID",
        "A dispatched run requires one to four active orders.",
      );
    if (
      activeStops.some(
        (stop) =>
          stop.order.paymentStatus !== OrderPaymentStatus.PAID ||
          stop.order.productionStatus !==
            OrderProductionStatus.AT_DISPATCH_DESK ||
          !new Set<OrderDispatchStatus>([
            OrderDispatchStatus.RUN_PLANNED,
            OrderDispatchStatus.READY_FOR_PICKUP,
          ]).has(stop.order.dispatchStatus),
      )
    ) {
      throw new RunOperationError(
        "ORDER_NOT_HANDOFF_READY",
        "Every bag must still be paid, ready, and assigned to this run.",
      );
    }
    const zoneIds = [
      ...new Set(
        activeStops
          .map((stop) => stop.order.deliveryZoneIdSnapshot)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    await eligibleDriver(tx, run.driverId, zoneIds, now);
    const otherActiveRun = await tx.deliveryRun.findFirst({
      where: {
        id: { not: run.id },
        driverId: run.driverId,
        status: {
          in: [
            DeliveryRunStatus.APPROVED,
            DeliveryRunStatus.READY,
            DeliveryRunStatus.PICKED_UP,
            DeliveryRunStatus.EN_ROUTE,
          ],
        },
      },
      select: { id: true },
    });
    if (otherActiveRun)
      throw new RunOperationError(
        "DRIVER_ALREADY_HAS_RUN",
        "The selected driver already has an active run.",
      );

    const routedWindow = composePickupDeliveryWindow(
      now,
      run.estimatedDurationSeconds,
    );
    for (const stop of activeStops) {
      await tx.deliveryStop.update({
        where: { id: stop.id },
        data: {
          status:
            stop.position === activeStops[0]!.position
              ? DeliveryStopStatus.EN_ROUTE
              : DeliveryStopStatus.PICKED_UP,
          bagVerifiedAt: stop.bagVerifiedAt ?? now,
          bagVerifiedBy: stop.bagVerifiedBy ?? input.actor.id,
          pickedUpAt: stop.pickedUpAt ?? now,
        },
      });
      await tx.order.update({
        where: { id: stop.orderId },
        data: {
          dispatchStatus: OrderDispatchStatus.EN_ROUTE,
          fulfillmentStatus: OrderFulfillmentStatus.ON_THE_WAY,
          ...(routedWindow
            ? {
                estimatedDeliveryStartAt: routedWindow.startAt,
                estimatedDeliveryEndAt: routedWindow.endAt,
              }
            : {}),
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: stop.orderId,
          actorType: OrderActorType.ADMIN,
          actorId: input.actor.id,
          actorLabel: input.actor.label,
          eventType: "RUN_DISPATCHED_AT_PHYSICAL_HANDOFF",
          fromFulfillmentStatus: stop.order.fulfillmentStatus,
          toFulfillmentStatus: OrderFulfillmentStatus.ON_THE_WAY,
          fromDispatchStatus: stop.order.dispatchStatus,
          toDispatchStatus: OrderDispatchStatus.EN_ROUTE,
          metadata: {
            runId: run.id,
            runNumber: run.runNumber,
            driverId: run.driverId,
            position: stop.position,
          },
        },
      });
    }
    return tx.deliveryRun.update({
      where: { id: run.id },
      data: {
        status: DeliveryRunStatus.EN_ROUTE,
        pickedUpAt: now,
        handedOffAt: now,
        handedOffByActorId: input.actor.id,
        handedOffByActorLabel: input.actor.label,
        dispatchedAt: now,
      },
      include: { stops: { orderBy: { position: "asc" } }, driver: true },
    });
  });
}

export async function pickupRun(
  client: PrismaClient,
  input: { runId: string; driverId: string },
) {
  return withSerializableRetry(client, async (tx) => {
    const run = await tx.deliveryRun.findUnique({
      where: { id: input.runId },
      include: {
        stops: {
          include: { order: { select: { deliveryZoneIdSnapshot: true } } },
        },
      },
    });
    if (!run || run.driverId !== input.driverId)
      throw new RunOperationError(
        "RUN_SCOPE_DENIED",
        "Run is not assigned to this driver.",
      );
    const pickupStops = run.stops.filter(
      (stop) => stop.status !== DeliveryStopStatus.CANCELLED,
    );
    if (
      run.status !== DeliveryRunStatus.READY ||
      pickupStops.length === 0 ||
      pickupStops.some(
        (stop) => stop.status !== DeliveryStopStatus.BAG_VERIFIED,
      )
    )
      throw new RunOperationError(
        "RUN_NOT_READY",
        "Every active bag must be verified before pickup.",
      );
    const zones = [
      ...new Set(
        pickupStops
          .map((stop) => stop.order.deliveryZoneIdSnapshot)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    await eligibleDriver(tx, input.driverId, zones, new Date());
    const now = new Date();
    const routedWindow = composePickupDeliveryWindow(now, run.estimatedDurationSeconds);
    await tx.deliveryStop.updateMany({
      where: {
        id: { in: pickupStops.map((stop) => stop.id) },
        status: DeliveryStopStatus.BAG_VERIFIED,
      },
      data: { status: DeliveryStopStatus.PICKED_UP, pickedUpAt: now },
    });
    await tx.order.updateMany({
      where: { id: { in: pickupStops.map((stop) => stop.orderId) } },
      data: { dispatchStatus: OrderDispatchStatus.PICKED_UP, fulfillmentStatus: OrderFulfillmentStatus.PICKED_UP, ...(routedWindow ? { estimatedDeliveryStartAt: routedWindow.startAt, estimatedDeliveryEndAt: routedWindow.endAt } : {}) },
    });
    await tx.orderEvent.createMany({
      data: pickupStops.map((stop) => ({
        orderId: stop.orderId,
        actorType: OrderActorType.DRIVER,
        actorId: input.driverId,
        eventType: "RUN_PICKED_UP",
        fromFulfillmentStatus: OrderFulfillmentStatus.DRIVER_ASSIGNED,
        toFulfillmentStatus: OrderFulfillmentStatus.PICKED_UP,
        fromDispatchStatus: OrderDispatchStatus.READY_FOR_PICKUP,
        toDispatchStatus: OrderDispatchStatus.PICKED_UP,
        metadata: { runId: run.id, routedDeliveryWindow: routedWindow ? { startAt: routedWindow.startAt.toISOString(), endAt: routedWindow.endAt.toISOString(), routeSeconds: run.estimatedDurationSeconds, bufferSeconds: ROUTED_DELIVERY_BUFFER_SECONDS } : null },
      })),
    });
    return tx.deliveryRun.update({
      where: { id: run.id },
      data: { status: DeliveryRunStatus.PICKED_UP, pickedUpAt: now },
      include: { stops: { orderBy: { position: "asc" } } },
    });
  });
}

export async function reassignRun(
  client: PrismaClient,
  input: { runId: string; driverId: string; reason: string; actor: Actor },
) {
  return withSerializableRetry(client, async (tx) => {
    const run = await tx.deliveryRun.findUnique({
      where: { id: input.runId },
      include: {
        stops: {
          include: { order: { select: { deliveryZoneIdSnapshot: true } } },
        },
      },
    });
    if (
      !run ||
      (run.status !== DeliveryRunStatus.APPROVED &&
        run.status !== DeliveryRunStatus.READY)
    )
      throw new RunOperationError(
        "RUN_NOT_REASSIGNABLE",
        "Only a run that has not been picked up can be reassigned.",
      );
    const zones = [
      ...new Set(
        run.stops
          .map((stop) => stop.order.deliveryZoneIdSnapshot)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    await eligibleDriver(tx, input.driverId, zones, new Date());
    const updated = await tx.deliveryRun.update({
      where: { id: run.id },
      data: { driverId: input.driverId },
    });
    await tx.orderEvent.createMany({
      data: run.stops.map((stop) => ({
        orderId: stop.orderId,
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: "DELIVERY_RUN_REASSIGNED",
        metadata: {
          runId: run.id,
          fromDriverId: run.driverId,
          toDriverId: input.driverId,
          reason: input.reason,
        },
      })),
    });
    return updated;
  });
}

export async function cancelRun(
  client: PrismaClient,
  input: { runId: string; reason: string; actor: Actor },
) {
  return withSerializableRetry(client, async (tx) => {
    const run = await tx.deliveryRun.findUnique({
      where: { id: input.runId },
      include: { stops: true },
    });
    if (
      !run ||
      (run.status !== DeliveryRunStatus.DRAFT &&
        run.status !== DeliveryRunStatus.APPROVED &&
        run.status !== DeliveryRunStatus.READY)
    )
      throw new RunOperationError(
        "RUN_NOT_CANCELLABLE",
        "A picked-up run cannot be cancelled; use a driver exception.",
      );
    const now = new Date();
    await tx.deliveryStop.updateMany({
      where: { runId: run.id },
      data: {
        status: DeliveryStopStatus.CANCELLED,
        cancelledAt: now,
        exceptionNote: input.reason,
      },
    });
    await tx.order.updateMany({
      where: { deliveryStops: { some: { runId: run.id } } },
      data: { dispatchStatus: OrderDispatchStatus.UNASSIGNED, fulfillmentStatus: OrderFulfillmentStatus.READY_FOR_PICKUP },
    });
    await tx.orderEvent.createMany({
      data: run.stops.map((stop) => ({
        orderId: stop.orderId,
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: "DELIVERY_RUN_CANCELLED",
        fromDispatchStatus: OrderDispatchStatus.RUN_PLANNED,
        toDispatchStatus: OrderDispatchStatus.UNASSIGNED,
        message: input.reason,
        metadata: { runId: run.id },
      })),
    });
    return tx.deliveryRun.update({
      where: { id: run.id },
      data: { status: DeliveryRunStatus.CANCELLED, cancelledAt: now },
    });
  });
}

export async function resolveRunException(
  client: PrismaClient,
  input: { runId: string; reason: string; actor: Actor },
) {
  return withSerializableRetry(client, async (tx) => {
    const run = await tx.deliveryRun.findUnique({
      where: { id: input.runId },
      include: { stops: true },
    });
    if (!run || run.status !== DeliveryRunStatus.EXCEPTION)
      throw new RunOperationError(
        "RUN_NOT_EXCEPTION",
        "Only an exception run can be resolved.",
      );
    const terminalStatuses = new Set<DeliveryStopStatus>([
      DeliveryStopStatus.DELIVERED,
      DeliveryStopStatus.RETURNED_TO_DESK,
      DeliveryStopStatus.CANCELLED,
    ]);
    if (run.stops.some((stop) => !terminalStatuses.has(stop.status)))
      throw new RunOperationError(
        "RUN_EXCEPTION_ACTIVE_STOPS",
        "Every failed bag must be physically confirmed back at the dispatch desk before the exception run can close.",
      );
    return tx.deliveryRun.update({
      where: { id: run.id },
      data: {
        status: DeliveryRunStatus.COMPLETED,
        completedAt: new Date(),
        overrideReason: [
          run.overrideReason,
          `Exception resolution: ${input.reason}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
  });
}

export async function confirmFailedStopReturnedToDesk(
  client: PrismaClient,
  input: { runId: string; orderId: string; reason: string; actor: Actor },
) {
  if (!input.reason.trim())
    throw new RunOperationError(
      "RETURN_REASON_REQUIRED",
      "Physical return confirmation requires a reason.",
    );
  return withSerializableRetry(client, async (tx) => {
    const run = await tx.deliveryRun.findUnique({
      where: { id: input.runId },
      include: { stops: true },
    });
    if (!run || run.status !== DeliveryRunStatus.EXCEPTION)
      throw new RunOperationError(
        "RUN_NOT_EXCEPTION",
        "Only an exception run can receive returned bags.",
      );
    const stop = run.stops.find(
      (candidate) => candidate.orderId === input.orderId,
    );
    if (!stop || stop.status !== DeliveryStopStatus.FAILED)
      throw new RunOperationError(
        "STOP_NOT_RETURNABLE",
        "Only a failed stop can be confirmed back at the desk.",
      );
    const now = new Date();
    const changed = await tx.deliveryStop.updateMany({
      where: { id: stop.id, status: DeliveryStopStatus.FAILED },
      data: {
        status: DeliveryStopStatus.RETURNED_TO_DESK,
        returnedToDeskAt: now,
      },
    });
    if (changed.count !== 1)
      throw new RunOperationError(
        "STOP_CHANGED",
        "The stop changed while its return was being confirmed.",
      );
    await tx.order.update({
      where: { id: stop.orderId },
      data: { dispatchStatus: OrderDispatchStatus.UNASSIGNED, fulfillmentStatus: OrderFulfillmentStatus.READY_FOR_PICKUP },
    });
    await tx.orderEvent.create({
      data: {
        orderId: stop.orderId,
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: "FAILED_DELIVERY_RETURNED_TO_DESK",
        fromDispatchStatus: OrderDispatchStatus.EXCEPTION,
        toDispatchStatus: OrderDispatchStatus.UNASSIGNED,
        message: input.reason.trim(),
        metadata: {
          runId: run.id,
          stopId: stop.id,
          physicalReturnConfirmed: true,
        },
      },
    });
    return tx.deliveryStop.findUniqueOrThrow({ where: { id: stop.id } });
  });
}

export async function updateDriverStop(
  client: PrismaClient,
  input: {
    runId: string;
    orderId: string;
    driverId: string;
    action: "EN_ROUTE" | "DELIVERED" | "FAILED";
    reason?: string;
  },
) {
  return withSerializableRetry(client, async (tx) => {
    const run = await tx.deliveryRun.findUnique({
      where: { id: input.runId },
      include: { stops: true },
    });
    if (!run || run.driverId !== input.driverId)
      throw new RunOperationError(
        "RUN_SCOPE_DENIED",
        "Run is not assigned to this driver.",
      );
    const stop = run.stops.find(
      (candidate) => candidate.orderId === input.orderId,
    );
    if (!stop)
      throw new RunOperationError("STOP_NOT_FOUND", "Stop is not in this run.");
    const now = new Date();
    if (input.action === "FAILED" && !input.reason?.trim())
      throw new RunOperationError(
        "EXCEPTION_REASON_REQUIRED",
        "A failed stop requires a reason.",
      );
    if (
      stop.status !== DeliveryStopStatus.PICKED_UP &&
      stop.status !== DeliveryStopStatus.EN_ROUTE
    )
      throw new RunOperationError(
        "STOP_TRANSITION_INVALID",
        "Stop is not in a deliverable state.",
      );
    const stopStatus =
      input.action === "EN_ROUTE"
        ? DeliveryStopStatus.EN_ROUTE
        : input.action === "DELIVERED"
          ? DeliveryStopStatus.DELIVERED
          : DeliveryStopStatus.FAILED;
    const dispatchStatus =
      input.action === "EN_ROUTE"
        ? OrderDispatchStatus.EN_ROUTE
        : input.action === "DELIVERED"
          ? OrderDispatchStatus.DELIVERED
          : OrderDispatchStatus.EXCEPTION;
    const fulfillmentStatus = input.action === "EN_ROUTE"
      ? OrderFulfillmentStatus.ON_THE_WAY
      : input.action === "DELIVERED"
        ? OrderFulfillmentStatus.DELIVERED
        : undefined;
    const updated = await tx.deliveryStop.update({
      where: { id: stop.id },
      data: {
        status: stopStatus,
        ...(input.action === "DELIVERED" ? { deliveredAt: now } : {}),
        ...(input.action === "FAILED"
          ? {
              failedAt: now,
              exceptionCode: "DRIVER_EXCEPTION",
              exceptionNote: input.reason,
            }
          : {}),
      },
    });
    await tx.order.update({
      where: { id: stop.orderId },
      data: { dispatchStatus, ...(fulfillmentStatus ? { fulfillmentStatus, ...(fulfillmentStatus === OrderFulfillmentStatus.DELIVERED ? { completedAt: now } : {}) } : {}) },
    });
    await tx.orderEvent.create({
      data: {
        orderId: stop.orderId,
        actorType: OrderActorType.DRIVER,
        actorId: input.driverId,
        eventType: `DELIVERY_STOP_${input.action}`,
        fromDispatchStatus:
          stop.status === DeliveryStopStatus.PICKED_UP
            ? OrderDispatchStatus.PICKED_UP
            : OrderDispatchStatus.EN_ROUTE,
        toDispatchStatus: dispatchStatus,
        ...(fulfillmentStatus ? {
          fromFulfillmentStatus: input.action === "EN_ROUTE" ? OrderFulfillmentStatus.PICKED_UP : OrderFulfillmentStatus.ON_THE_WAY,
          toFulfillmentStatus: fulfillmentStatus,
        } : {}),
        message: input.reason,
        metadata: { runId: run.id, stopId: stop.id },
      },
    });
    if (input.action === "FAILED")
      await tx.deliveryRun.update({
        where: { id: run.id },
        data: { status: DeliveryRunStatus.EXCEPTION },
      });
    else if (
      input.action === "EN_ROUTE" &&
      run.status === DeliveryRunStatus.PICKED_UP
    )
      await tx.deliveryRun.update({
        where: { id: run.id },
        data: { status: DeliveryRunStatus.EN_ROUTE },
      });
    else if (input.action === "DELIVERED") {
      const incomplete = await tx.deliveryStop.count({
        where: {
          runId: run.id,
          id: { not: stop.id },
          status: {
            notIn: [DeliveryStopStatus.DELIVERED, DeliveryStopStatus.CANCELLED],
          },
        },
      });
      if (incomplete === 0)
        await tx.deliveryRun.update({
          where: { id: run.id },
          data: { status: DeliveryRunStatus.COMPLETED, completedAt: now },
        });
    }
    return updated;
  });
}

export async function listDriverRuns(client: PrismaClient, driverId: string) {
  return client.deliveryRun.findMany({
    where: {
      driverId,
      status: {
        in: [
          DeliveryRunStatus.EN_ROUTE,
          DeliveryRunStatus.EXCEPTION,
        ],
      },
    },
    include: {
      stops: {
        orderBy: { position: "asc" },
        include: {
          proof: {
            select: {
              id: true,
              status: true,
              mimeType: true,
              byteSize: true,
              capturedAt: true,
              storedAt: true,
            },
          },
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              customerPhone: true,
              deliveryAddressLine1: true,
              deliveryAddressLine2: true,
              deliveryCity: true,
              deliveryPostalCode: true,
              deliveryInstructions: true,
              estimatedDeliveryEndAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
