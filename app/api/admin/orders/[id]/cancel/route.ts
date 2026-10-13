import {
  DeliveryRunStatus,
  DeliveryStopStatus,
  OrderActorType,
  OrderDispatchStatus,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderProductionStatus,
  OrderRefundStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { prepareRefundIntentInTransaction, refundPaidOrder } from "@/lib/orders/refunds";
import { canTransitionFulfillmentStatus } from "@/lib/orders/status";
import { notifyCancelledRefundPending, notifyRefundFailedAdminAlert, notifyRefundSucceeded } from "@/lib/orders/notifications";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.object({ requestKey: z.string().min(8).max(200), reason: z.string().trim().min(1).max(1000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser("REFUND_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR" } }, { status: 400 });
  const orderId = (await params).id;
  let order;
  try {
    order = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const current = await tx.order.findUnique({ where: { id: orderId } });
    if (!current) return null;
    if (!canTransitionFulfillmentStatus(current.fulfillmentStatus, OrderFulfillmentStatus.CANCELLED)) {
      throw new Error("ORDER_NOT_CANCELLABLE");
    }
    const now = new Date();
    const needsRefund = current.paymentStatus === OrderPaymentStatus.PAID || current.paymentStatus === OrderPaymentStatus.PARTIALLY_REFUNDED;
    const updated = await tx.order.update({ where: { id: orderId }, data: {
      fulfillmentStatus: OrderFulfillmentStatus.CANCELLED,
      productionStatus: OrderProductionStatus.CANCELLED,
      dispatchStatus: OrderDispatchStatus.CANCELLED,
      refundStatus: needsRefund ? OrderRefundStatus.REQUIRED : current.refundStatus,
      cancelledAt: now,
    } });
    const activeStops = await tx.deliveryStop.findMany({
      where: { orderId, status: { in: [DeliveryStopStatus.PLANNED, DeliveryStopStatus.BAG_VERIFIED] } },
      select: { id: true, runId: true },
    });
    if (activeStops.length) {
      await tx.deliveryStop.updateMany({
        where: { id: { in: activeStops.map((stop) => stop.id) } },
        data: { status: DeliveryStopStatus.CANCELLED, cancelledAt: now, exceptionNote: parsed.data.reason },
      });
      for (const runId of [...new Set(activeStops.map((stop) => stop.runId))]) {
        const remaining = await tx.deliveryStop.count({
          where: { runId, status: { in: [DeliveryStopStatus.PLANNED, DeliveryStopStatus.BAG_VERIFIED, DeliveryStopStatus.PICKED_UP, DeliveryStopStatus.EN_ROUTE] } },
        });
        if (remaining === 0) await tx.deliveryRun.updateMany({
          where: { id: runId, status: { in: [DeliveryRunStatus.DRAFT, DeliveryRunStatus.APPROVED, DeliveryRunStatus.READY] } },
          data: { status: DeliveryRunStatus.CANCELLED, cancelledAt: now },
        });
      }
    }
    const preparedRefund = needsRefund ? await prepareRefundIntentInTransaction(tx, { orderId, requestKey: parsed.data.requestKey, reason: parsed.data.reason, actorId: actor.staff.id, actorLabel: actor.staff.displayName }) : null;
    await tx.orderEvent.create({ data: { orderId, actorType: OrderActorType.ADMIN, actorId: actor.staff.id, actorLabel: actor.staff.displayName, eventType: "ORDER_CANCELLED", fromFulfillmentStatus: current.fulfillmentStatus, toFulfillmentStatus: OrderFulfillmentStatus.CANCELLED, message: parsed.data.reason, metadata: { refundRequired: needsRefund, refundIntentId: preparedRefund?.intent.id ?? null } } });
    return { order: updated, refundIntentId: preparedRefund?.intent.id ?? null };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_CANCELLABLE") {
      return NextResponse.json({ ok: false, error: { code: "ORDER_NOT_CANCELLABLE" } }, { status: 409 });
    }
    throw error;
  }
  if (!order) return NextResponse.json({ ok: false, error: { code: "ORDER_NOT_FOUND" } }, { status: 404 });
  const paidCancellation = order.order.paymentStatus === OrderPaymentStatus.PAID || order.order.paymentStatus === OrderPaymentStatus.PARTIALLY_REFUNDED;
  if (paidCancellation) await notifyCancelledRefundPending(orderId);
  const refund = paidCancellation
    ? await refundPaidOrder({ orderId, requestKey: parsed.data.requestKey, reason: parsed.data.reason, actorId: actor.staff.id, actorLabel: actor.staff.displayName })
    : null;
  const refundOutcome = refund?.refund;
  if (refundOutcome?.succeeded) await notifyRefundSucceeded(orderId);
  else if (refundOutcome?.failed) await notifyRefundFailedAdminAlert({ orderId, error: refundOutcome.rawResponse });
  return NextResponse.json({ ok: true, data: { order: order.order, refund } });
}
