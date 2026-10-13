import {
  AsyncJobState,
  OrderActorType,
  OrderDispatchStatus,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderProductionStatus,
  OrderRefundStatus,
  Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { dispatchAggregateJobs } from "@/lib/async-jobs/dispatch";
import { getSerializedAdminOrder } from "@/lib/orders/admin";
import {
  notifyRefundFailedAdminAlert,
  notifyRefundSucceeded,
  notifyRejectedRefundPending,
} from "@/lib/orders/notifications";
import { prepareRefundIntentInTransaction, refundPaidOrder } from "@/lib/orders/refunds";
import { canTransitionFulfillmentStatus } from "@/lib/orders/status";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const rejectOrderSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staffActor = await getStaffUserWithAnyCapability([
    "ORDER_INTAKE_WRITE",
    "REFUND_WRITE",
  ]);
  if (!staffActor) {
    return errorResponse(403, "FORBIDDEN", "Order intake capability required.");
  }
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid order id.", parsedParams.error.issues);
  }

  const { id } = parsedParams.data;
  let payload: z.infer<typeof rejectOrderSchema>;

  try {
    payload = rejectOrderSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid rejection request.", error.issues);
    }
    return errorResponse(400, "INVALID_JSON", "Invalid rejection request.");
  }

  const order = await db.order.findUnique({
    where: { id },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });

  if (!order) {
    return errorResponse(404, "ORDER_NOT_FOUND", "Order not found.");
  }

  if (order.fulfillmentStatus === OrderFulfillmentStatus.REJECTED) {
    return errorResponse(409, "ORDER_ALREADY_REJECTED", "Order has already been rejected.");
  }

  if (
    !canTransitionFulfillmentStatus(
      order.fulfillmentStatus,
      OrderFulfillmentStatus.REJECTED,
    )
  ) {
    return errorResponse(409, "ORDER_NOT_REJECTABLE", "Order cannot be rejected from its current status.");
  }

  const rejectedOrder = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
    const current = await tx.order.findUnique({
      where: { id: order.id },
      select: {
        id: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        refundStatus: true,
      },
    });

    if (!current) {
      throw new Error("Order disappeared during rejection.");
    }

    if (current.fulfillmentStatus === OrderFulfillmentStatus.REJECTED) {
      return null;
    }

    if (
      !canTransitionFulfillmentStatus(
        current.fulfillmentStatus,
        OrderFulfillmentStatus.REJECTED,
      )
    ) {
      throw new Error("Order is no longer rejectable.");
    }

    const nextRefundStatus =
      (current.paymentStatus === OrderPaymentStatus.PAID || current.paymentStatus === OrderPaymentStatus.PARTIALLY_REFUNDED) && current.refundStatus === OrderRefundStatus.NOT_REQUIRED
        ? OrderRefundStatus.REQUIRED
        : current.paymentStatus === OrderPaymentStatus.PENDING
          ? OrderRefundStatus.NOT_REQUIRED
          : current.refundStatus;

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: OrderFulfillmentStatus.REJECTED,
        productionStatus: OrderProductionStatus.REJECTED,
        dispatchStatus: OrderDispatchStatus.CANCELLED,
        refundStatus: nextRefundStatus,
        rejectedAt: new Date(),
        rejectionReason: payload.reason,
        acceptanceDecisionAt: new Date(),
      },
      include: { payments: { orderBy: { createdAt: "desc" } } },
    });

    const preparedRefund = (current.paymentStatus === OrderPaymentStatus.PAID || current.paymentStatus === OrderPaymentStatus.PARTIALLY_REFUNDED)
      ? await prepareRefundIntentInTransaction(tx, { orderId: order.id, requestKey: `reject:${order.id}:remaining`, reason: payload.reason, actorId: staffActor.staff.id, actorLabel: staffActor.staff.displayName })
      : null;
    await tx.asyncJob.updateMany({
      where: {
        dedupeKey: `order-acceptance:${order.id}`,
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
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderActorType.ADMIN,
        actorId: staffActor.staff.id,
        actorLabel: staffActor.staff.displayName,
        eventType: "ORDER_REJECTED",
        fromPaymentStatus: current.paymentStatus,
        toPaymentStatus: updated.paymentStatus,
        fromFulfillmentStatus: current.fulfillmentStatus,
        toFulfillmentStatus: OrderFulfillmentStatus.REJECTED,
        message: payload.reason,
        metadata: toPrismaJson({
          refundStatus: updated.refundStatus,
          refundRequired: nextRefundStatus === OrderRefundStatus.REQUIRED,
          refundIntentId: preparedRefund?.intent.id ?? null,
        }),
      },
    });

    return updated;
  });

  if (!rejectedOrder) {
    return errorResponse(409, "ORDER_ALREADY_REJECTED", "Order has already been rejected.");
  }

  const refundResult = rejectedOrder.paymentStatus === OrderPaymentStatus.PAID || rejectedOrder.paymentStatus === OrderPaymentStatus.PARTIALLY_REFUNDED
    ? await refundPaidOrder({
      orderId: rejectedOrder.id,
      requestKey: `reject:${rejectedOrder.id}:remaining`,
      reason: payload.reason,
      actorId: staffActor.staff.id,
      actorLabel: staffActor.staff.displayName,
    })
    : null;
  await dispatchAggregateJobs("Order", rejectedOrder.id);
  const refundOutcome = refundResult?.refund ?? (refundResult ? {
    state: "requires_review",
    succeeded: false,
    failed: false,
    pending: true,
    rawResponse: { refundIntentId: refundResult.intent.id, status: refundResult.intent.status },
  } : null);

  await notifyRejectedRefundPending(rejectedOrder.id);

  if (refundOutcome && typeof refundOutcome === "object") {
    if ("succeeded" in refundOutcome && refundOutcome.succeeded) {
      await notifyRefundSucceeded(rejectedOrder.id);
    } else if ("failed" in refundOutcome && refundOutcome.failed) {
      await notifyRefundFailedAdminAlert({
        orderId: rejectedOrder.id,
        error: refundOutcome.rawResponse,
      });
    }
  }

  const serializedOrder = await getSerializedAdminOrder(rejectedOrder.id);

  return NextResponse.json({
    ok: true,
    data: {
      order: serializedOrder,
      refund: refundOutcome,
    },
  });
}
