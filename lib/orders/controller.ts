import "server-only";

import {
  AsyncJobState,
  OrderActorType,
  OrderDispatchStatus,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderProductionStatus,
  OrderRefundStatus,
  PrintJobStatus,
  Prisma,
} from "@prisma/client";

import { dispatchAggregateJobs } from "@/lib/async-jobs/dispatch";
import { db } from "@/lib/db";
import { withSerializableRetry } from "@/lib/db-transactions";
import {
  notifyOrderFulfillmentStatus,
  notifyOrderTemplate,
  notifyRefundFailedAdminAlert,
  notifyRefundSucceeded,
  notifyRejectedRefundPending,
} from "@/lib/orders/notifications";
import {
  prepareRefundIntentInTransaction,
  refundPaidOrder,
} from "@/lib/orders/refunds";

export type ControllerActor = { id: string; label: string };

export class ControllerOrderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = "ControllerOrderError";
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function cancelAcceptanceJob(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  await tx.asyncJob.updateMany({
    where: {
      dedupeKey: `order-acceptance:${orderId}`,
      state: {
        in: [
          AsyncJobState.PENDING,
          AsyncJobState.DISPATCHING,
          AsyncJobState.DISPATCHED,
          AsyncJobState.FAILED,
        ],
      },
    },
    data: { state: AsyncJobState.CANCELLED },
  });
}

export async function acceptAndStartPreparing(input: {
  orderId: string;
  actor: ControllerActor;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const result = await withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { printJobs: { orderBy: { createdAt: "desc" } } },
    });
    if (!order)
      throw new ControllerOrderError(
        "ORDER_NOT_FOUND",
        "Order not found.",
        404,
      );
    if (
      order.productionStatus === OrderProductionStatus.PREPARING &&
      order.acceptanceDecisionAt
    ) {
      return { order, changed: false };
    }
    if (
      order.paymentStatus !== OrderPaymentStatus.PAID ||
      order.productionStatus !== OrderProductionStatus.AWAITING_ACCEPTANCE
    ) {
      throw new ControllerOrderError(
        "ORDER_NOT_ACCEPTABLE",
        "This order is no longer awaiting acceptance.",
      );
    }
    if (
      order.acceptanceDeadlineAt &&
      order.acceptanceDeadlineAt.getTime() <= now.getTime()
    ) {
      throw new ControllerOrderError(
        "ACCEPTANCE_DEADLINE_EXPIRED",
        "The response deadline has passed. Refresh to see the timeout outcome.",
      );
    }
    const confirmedKitchenTicket = order.printJobs.some(
      (job) =>
        ["INITIAL", "FALLBACK"].includes(job.purpose) &&
        job.status === PrintJobStatus.PRINTED,
    );
    if (!confirmedKitchenTicket) {
      throw new ControllerOrderError(
        "KITCHEN_TICKET_NOT_CONFIRMED",
        "Confirm the initial kitchen ticket before starting preparation.",
      );
    }

    const changed = await tx.order.updateMany({
      where: {
        id: order.id,
        paymentStatus: OrderPaymentStatus.PAID,
        productionStatus: OrderProductionStatus.AWAITING_ACCEPTANCE,
        acceptanceDecisionAt: null,
      },
      data: {
        productionStatus: OrderProductionStatus.PREPARING,
        fulfillmentStatus: OrderFulfillmentStatus.PREPARING,
        acceptedAt: now,
        acceptanceDecisionAt: now,
        preparationStartedAt: now,
      },
    });
    if (changed.count !== 1)
      throw new ControllerOrderError(
        "ORDER_CHANGED",
        "The order changed while it was being accepted.",
      );

    await tx.restaurantOrderSettings.upsert({
      where: { id: 1 },
      create: { id: 1, missedAcceptanceCount: 0 },
      update: { missedAcceptanceCount: 0 },
    });
    await cancelAcceptanceJob(tx, order.id);
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: "ORDER_ACCEPTED_AND_PREPARATION_STARTED",
        fromFulfillmentStatus: order.fulfillmentStatus,
        toFulfillmentStatus: OrderFulfillmentStatus.PREPARING,
        fromProductionStatus: order.productionStatus,
        toProductionStatus: OrderProductionStatus.PREPARING,
        metadata: json({
          acceptanceDeadlineAt:
            order.acceptanceDeadlineAt?.toISOString() ?? null,
        }),
      },
    });
    return {
      order: await tx.order.findUniqueOrThrow({ where: { id: order.id } }),
      changed: true,
    };
  });

  if (result.changed) {
    await dispatchAggregateJobs("Order", input.orderId);
    await notifyOrderFulfillmentStatus(
      input.orderId,
      OrderFulfillmentStatus.ACCEPTED,
      { controller: input.actor.label },
    );
  }
  return result.order;
}

export async function addPreparationTime(input: {
  orderId: string;
  minutes: 5 | 10 | 15;
  reason: string;
  requestKey: string;
  actor: ControllerActor;
  now?: Date;
}) {
  const reason = input.reason.trim();
  const requestKey = input.requestKey.trim();
  if (!reason)
    throw new ControllerOrderError(
      "PREPARATION_REASON_REQUIRED",
      "A reason is required when adding preparation time.",
      400,
    );
  if (!requestKey || requestKey.length > 200)
    throw new ControllerOrderError(
      "REQUEST_KEY_INVALID",
      "A valid request key is required.",
      400,
    );
  const now = input.now ?? new Date();
  const result = await withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order)
      throw new ControllerOrderError(
        "ORDER_NOT_FOUND",
        "Order not found.",
        404,
      );
    const replay = await tx.orderEvent.findUnique({ where: { requestKey } });
    if (replay) {
      if (
        replay.orderId !== order.id ||
        replay.eventType !== "PREPARATION_TIME_ADDED"
      )
        throw new ControllerOrderError(
          "IDEMPOTENCY_CONFLICT",
          "This request key was already used for another operation.",
        );
      return { order, changed: false };
    }
    if (
      !new Set<OrderProductionStatus>([
        OrderProductionStatus.ACCEPTED,
        OrderProductionStatus.PREPARING,
        OrderProductionStatus.PACKING,
      ]).has(order.productionStatus)
    ) {
      throw new ControllerOrderError(
        "ORDER_NOT_PREPARING",
        "Preparation time can only be added to an order being prepared.",
      );
    }
    const delta = input.minutes * 60_000;
    const baseReady = order.estimatedReadyEndAt ?? now;
    const baseDeliveryStart = order.estimatedDeliveryStartAt;
    const baseDeliveryEnd = order.estimatedDeliveryEndAt;
    const basePromiseStart = order.promisedDeliveryStartAt;
    const basePromiseEnd = order.promisedDeliveryEndAt;
    const baseDeadline = order.dispatchDeadlineAt;
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        preparationExtendedMinutes: { increment: input.minutes },
        estimatedReadyEndAt: new Date(
          Math.max(baseReady.getTime(), now.getTime()) + delta,
        ),
        ...(baseDeliveryStart
          ? { estimatedDeliveryStartAt: new Date(baseDeliveryStart.getTime() + delta) }
          : {}),
        ...(baseDeliveryEnd
          ? { estimatedDeliveryEndAt: new Date(baseDeliveryEnd.getTime() + delta) }
          : {}),
        ...(basePromiseStart
          ? { promisedDeliveryStartAt: new Date(basePromiseStart.getTime() + delta) }
          : {}),
        ...(basePromiseEnd
          ? { promisedDeliveryEndAt: new Date(basePromiseEnd.getTime() + delta) }
          : {}),
        ...(baseDeadline
          ? { dispatchDeadlineAt: new Date(baseDeadline.getTime() + delta) }
          : {}),
      },
    });
    await tx.orderEvent.create({
      data: {
        requestKey,
        orderId: order.id,
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: "PREPARATION_TIME_ADDED",
        message: reason,
        metadata: json({ minutes: input.minutes }),
      },
    });
    return { order: updated, changed: true };
  });
  if (result.changed) {
    await dispatchAggregateJobs("Order", input.orderId);
    await notifyOrderTemplate(
      input.orderId,
      "ORDER_PREPARING",
      { delayMinutes: input.minutes, reason },
      requestKey,
    );
  }
  return result.order;
}

export async function markReadyForDelivery(input: {
  orderId: string;
  actor: ControllerActor;
  orderNumberConfirmed: boolean;
  now?: Date;
}) {
  if (!input.orderNumberConfirmed)
    throw new ControllerOrderError(
      "ORDER_NUMBER_CONFIRMATION_REQUIRED",
      "Confirm the bag and ticket order number before marking ready.",
      400,
    );
  const now = input.now ?? new Date();
  const result = await withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });
    if (!order)
      throw new ControllerOrderError(
        "ORDER_NOT_FOUND",
        "Order not found.",
        404,
      );
    if (order.productionStatus === OrderProductionStatus.AT_DISPATCH_DESK)
      return { order, changed: false };
    if (
      order.paymentStatus !== OrderPaymentStatus.PAID ||
      !new Set<OrderProductionStatus>([
        OrderProductionStatus.ACCEPTED,
        OrderProductionStatus.PREPARING,
        OrderProductionStatus.PACKING,
        OrderProductionStatus.PACKED,
      ]).has(order.productionStatus)
    ) {
      throw new ControllerOrderError(
        "ORDER_NOT_READYABLE",
        "Only a paid order being prepared can be marked ready.",
      );
    }
    if (order.items.length === 0)
      throw new ControllerOrderError(
        "ORDER_HAS_NO_ITEMS",
        "An empty order cannot be marked ready.",
      );
    for (const item of order.items) {
      await tx.packingCheck.upsert({
        where: {
          orderId_orderItemId: { orderId: order.id, orderItemId: item.id },
        },
        create: {
          orderId: order.id,
          orderItemId: item.id,
          expectedQuantity: item.quantity,
          verifiedQuantity: item.quantity,
          instructionsAcknowledged: Boolean(item.specialInstructions),
          actorId: input.actor.id,
          actorLabel: input.actor.label,
          verifiedAt: now,
        },
        update: {
          expectedQuantity: item.quantity,
          verifiedQuantity: item.quantity,
          instructionsAcknowledged: Boolean(item.specialInstructions),
          actorId: input.actor.id,
          actorLabel: input.actor.label,
          verifiedAt: now,
        },
      });
    }
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        productionStatus: OrderProductionStatus.AT_DISPATCH_DESK,
        fulfillmentStatus: OrderFulfillmentStatus.READY_FOR_PICKUP,
        packingStartedAt: order.packingStartedAt ?? now,
        packedAt: order.packedAt ?? now,
        atDispatchDeskAt: now,
        readyForDeliveryAt: now,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: "ORDER_READY_FOR_DELIVERY",
        fromFulfillmentStatus: order.fulfillmentStatus,
        toFulfillmentStatus: OrderFulfillmentStatus.READY_FOR_PICKUP,
        fromProductionStatus: order.productionStatus,
        toProductionStatus: OrderProductionStatus.AT_DISPATCH_DESK,
        metadata: json({
          itemCount: order.items.length,
          orderNumberConfirmed: true,
        }),
      },
    });
    return { order: updated, changed: true };
  });
  if (result.changed) {
    await dispatchAggregateJobs("Order", input.orderId);
  }
  return result.order;
}

export async function expireOrderAcceptance(
  orderId: string,
  now = new Date(),
  provider?: NonNullable<Parameters<typeof refundPaidOrder>[0]["provider"]>,
) {
  const result = await withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return { expired: false as const, reason: "ORDER_NOT_FOUND" };
    if (
      order.paymentStatus !== OrderPaymentStatus.PAID ||
      order.productionStatus !== OrderProductionStatus.AWAITING_ACCEPTANCE ||
      order.acceptanceDecisionAt
    ) {
      return { expired: false as const, reason: "ALREADY_DECIDED" };
    }
    if (
      !order.acceptanceDeadlineAt ||
      order.acceptanceDeadlineAt.getTime() > now.getTime()
    ) {
      return { expired: false as const, reason: "DEADLINE_NOT_REACHED" };
    }
    const reason = "Restaurant response deadline expired";
    const nextRefundStatus =
      order.refundStatus === OrderRefundStatus.NOT_REQUIRED
        ? OrderRefundStatus.REQUIRED
        : order.refundStatus;
    await tx.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: OrderFulfillmentStatus.REJECTED,
        productionStatus: OrderProductionStatus.REJECTED,
        dispatchStatus: OrderDispatchStatus.CANCELLED,
        refundStatus: nextRefundStatus,
        rejectionReason: reason,
        rejectedAt: now,
        acceptanceDecisionAt: now,
        acceptanceTimedOutAt: now,
      },
    });
    const prepared = await prepareRefundIntentInTransaction(tx, {
      orderId: order.id,
      requestKey: `acceptance-timeout:${order.id}:remaining`,
      reason,
      actorId: "system:acceptance-deadline",
      actorLabel: "Acceptance deadline",
    });
    const settings = await tx.restaurantOrderSettings.upsert({
      where: { id: 1 },
      create: { id: 1, missedAcceptanceCount: 1 },
      update: { missedAcceptanceCount: { increment: 1 } },
    });
    const missedCount = settings.missedAcceptanceCount;
    const paused = missedCount >= settings.missedAcceptancePauseThreshold;
    if (paused && !settings.intakePausedAt) {
      await tx.restaurantOrderSettings.update({
        where: { id: 1 },
        data: {
          intakePausedAt: now,
          intakePauseReason: "MISSED_ACCEPTANCE_DEADLINES",
          intakePausedBy: "system:acceptance-deadline",
        },
      });
      await tx.operationalAuditEvent.create({
        data: {
          actorType: OrderActorType.SYSTEM,
          actorId: "system:acceptance-deadline",
          actorLabel: "Acceptance deadline",
          eventType: "ORDER_INTAKE_AUTO_PAUSED",
          entityType: "RestaurantOrderSettings",
          entityId: "1",
          reason,
          metadata: json({ missedAcceptanceCount: missedCount }),
        },
      });
    }
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderActorType.SYSTEM,
        actorId: "system:acceptance-deadline",
        actorLabel: "Acceptance deadline",
        eventType: "ORDER_ACCEPTANCE_TIMED_OUT",
        fromFulfillmentStatus: order.fulfillmentStatus,
        toFulfillmentStatus: OrderFulfillmentStatus.REJECTED,
        fromProductionStatus: order.productionStatus,
        toProductionStatus: OrderProductionStatus.REJECTED,
        message: reason,
        metadata: json({
          missedAcceptanceCount: missedCount,
          intakePaused: paused,
          refundIntentId: prepared.intent.id,
        }),
      },
    });
    return {
      expired: true as const,
      orderId: order.id,
      paused,
      missedCount,
    };
  });

  if (!result.expired) return result;
  await dispatchAggregateJobs("Order", orderId);
  const refund = await refundPaidOrder({
    orderId,
    requestKey: `acceptance-timeout:${orderId}:remaining`,
    reason: "Restaurant response deadline expired",
    actorId: "system:acceptance-deadline",
    actorLabel: "Acceptance deadline",
    provider,
  });
  await notifyRejectedRefundPending(orderId);
  if (refund.refund?.succeeded) await notifyRefundSucceeded(orderId);
  if (refund.refund?.failed)
    await notifyRefundFailedAdminAlert({
      orderId,
      error: refund.refund.rawResponse,
    });
  return result;
}

export async function resumeOrderIntake(input: {
  actor: ControllerActor;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason)
    throw new ControllerOrderError(
      "RESUME_REASON_REQUIRED",
      "A reason is required to resume order intake.",
      400,
    );
  return withSerializableRetry(db, async (tx) => {
    await tx.restaurantOrderSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
    await tx.$queryRaw`SELECT "id" FROM "RestaurantOrderSettings" WHERE "id" = 1 FOR UPDATE`;
    const settings = await tx.restaurantOrderSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    if (!settings.intakePausedAt) return settings;
    const updated = await tx.restaurantOrderSettings.update({
      where: { id: 1 },
      data: {
        intakePausedAt: null,
        intakePauseReason: null,
        intakePausedBy: null,
        missedAcceptanceCount: 0,
      },
    });
    await tx.operationalAuditEvent.create({
      data: {
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: "ORDER_INTAKE_RESUMED",
        entityType: "RestaurantOrderSettings",
        entityId: "1",
        reason,
      },
    });
    return updated;
  });
}
