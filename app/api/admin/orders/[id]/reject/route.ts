import {
  OrderActorType,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderRefundStatus,
  Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { getSerializedAdminOrder } from "@/lib/orders/admin";
import {
  notifyRefundFailedAdminAlert,
  notifyRefundSucceeded,
  notifyRejectedRefundPending,
} from "@/lib/orders/notifications";
import { refundPaidOrder, OrderRefundError } from "@/lib/orders/refunds";
import { canTransitionFulfillmentStatus } from "@/lib/orders/status";
import { getAdminUser } from "@/lib/supabase/auth";

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
  const user = await getAdminUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
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

  let refundOutcome = null;

  if (order.paymentStatus === OrderPaymentStatus.PAID) {
    try {
      const refundResult = await refundPaidOrder({
        orderId: order.id,
        amountCents: order.totalCents,
        actorId: user.id,
        actorLabel: user.email ?? "Admin",
      });
      refundOutcome = refundResult.refund;
    } catch (error) {
      if (!(error instanceof OrderRefundError)) {
        console.error(error);
        return errorResponse(500, "REFUND_ERROR", "Unable to process Clover refund.");
      }

      const failedRefund = {
        state: "failed",
        succeeded: false,
        partial: false,
        pending: false,
        failed: true,
        providerRefundId: null,
        providerPaymentId: null,
        providerOrderId: null,
        amountCents: order.totalCents,
        rawResponse: { code: error.code, message: error.message },
      };

      await db.payment.updateMany({
        where: { orderId: order.id, status: OrderPaymentStatus.PAID },
        data: { refundStatus: OrderRefundStatus.FAILED },
      });
      await db.order.update({
        where: { id: order.id },
        data: { refundStatus: OrderRefundStatus.FAILED },
      });
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          actorType: OrderActorType.SYSTEM,
          actorId: user.id,
          actorLabel: user.email ?? "Admin",
          eventType: "ORDER_REFUND_FAILED",
          fromPaymentStatus: order.paymentStatus,
          toPaymentStatus: order.paymentStatus,
          message: "Refund could not be requested. Manual follow-up is required.",
          metadata: toPrismaJson(failedRefund),
        },
      });

      refundOutcome = failedRefund;
    }
  }

  const rejectedOrder = await db.$transaction(async (tx) => {
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
      current.paymentStatus === OrderPaymentStatus.PAID && current.refundStatus === OrderRefundStatus.NOT_REQUIRED
        ? OrderRefundStatus.REQUIRED
        : current.paymentStatus === OrderPaymentStatus.PENDING
          ? OrderRefundStatus.NOT_REQUIRED
          : current.refundStatus;

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: OrderFulfillmentStatus.REJECTED,
        refundStatus: nextRefundStatus,
        rejectedAt: new Date(),
        rejectionReason: payload.reason,
      },
      include: { payments: { orderBy: { createdAt: "desc" } } },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderActorType.ADMIN,
        actorId: user.id,
        actorLabel: user.email ?? "Admin",
        eventType: "ORDER_REJECTED",
        fromPaymentStatus: current.paymentStatus,
        toPaymentStatus: updated.paymentStatus,
        fromFulfillmentStatus: current.fulfillmentStatus,
        toFulfillmentStatus: OrderFulfillmentStatus.REJECTED,
        message: payload.reason,
        metadata: toPrismaJson({
          refundStatus: updated.refundStatus,
          refundOutcome,
        }),
      },
    });

    return updated;
  });

  if (!rejectedOrder) {
    return errorResponse(409, "ORDER_ALREADY_REJECTED", "Order has already been rejected.");
  }

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
