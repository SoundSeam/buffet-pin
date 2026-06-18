import "server-only";

import {
  OrderActorType,
  OrderPaymentStatus,
  OrderRefundStatus,
  PaymentProvider,
  Prisma,
  type Payment,
} from "@prisma/client";

import { refundCloverPayment, type CloverRefundResult } from "@/lib/clover/refunds";
import { db } from "@/lib/db";

export class OrderRefundError extends Error {
  constructor(
    public readonly code:
      | "ORDER_NOT_FOUND"
      | "ORDER_NOT_PAID"
      | "PAYMENT_NOT_FOUND"
      | "PAYMENT_NOT_REFUNDABLE"
      | "REFUND_ALREADY_SUCCEEDED",
    message: string,
  ) {
    super(message);
    this.name = "OrderRefundError";
  }
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function refundStatusForResult(result: CloverRefundResult): OrderRefundStatus {
  if (result.succeeded) return OrderRefundStatus.SUCCEEDED;
  if (result.partial) return OrderRefundStatus.PARTIAL;
  if (result.pending) return OrderRefundStatus.PENDING;
  return OrderRefundStatus.FAILED;
}

function paymentStatusForRefund({
  result,
  payment,
  amountCents,
}: {
  result: CloverRefundResult;
  payment: Payment;
  amountCents: number;
}): OrderPaymentStatus {
  if (!result.succeeded && !result.partial) {
    return payment.status;
  }

  const nextRefundedAmount = payment.refundedAmountCents + amountCents;
  return nextRefundedAmount >= payment.amountCents
    ? OrderPaymentStatus.REFUNDED
    : OrderPaymentStatus.PARTIALLY_REFUNDED;
}

function latestRefundablePayment(payments: Payment[]): Payment | null {
  return (
    payments.find(
      (payment) =>
        payment.provider === PaymentProvider.CLOVER &&
        payment.status === OrderPaymentStatus.PAID &&
        payment.refundStatus !== OrderRefundStatus.SUCCEEDED &&
        payment.amountCents > payment.refundedAmountCents,
    ) ?? null
  );
}

export async function refundPaidOrder({
  orderId,
  amountCents,
  actorId,
  actorLabel,
}: {
  orderId: string;
  amountCents?: number;
  actorId?: string;
  actorLabel?: string;
}) {
  const prepared = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { payments: { orderBy: { createdAt: "desc" } } },
    });

    if (!order) {
      throw new OrderRefundError("ORDER_NOT_FOUND", "Order not found.");
    }

    if (order.paymentStatus !== OrderPaymentStatus.PAID) {
      throw new OrderRefundError("ORDER_NOT_PAID", "Order is not paid.");
    }

    if (order.refundStatus === OrderRefundStatus.SUCCEEDED) {
      throw new OrderRefundError(
        "REFUND_ALREADY_SUCCEEDED",
        "Order has already been refunded.",
      );
    }

    const payment = latestRefundablePayment(order.payments);

    if (!payment) {
      throw new OrderRefundError(
        "PAYMENT_NOT_FOUND",
        "No paid Clover payment is available to refund.",
      );
    }

    if (!payment.providerPaymentId && !payment.providerOrderId) {
      throw new OrderRefundError(
        "PAYMENT_NOT_REFUNDABLE",
        "Clover payment identifiers are missing.",
      );
    }

    const refundableAmount = payment.amountCents - payment.refundedAmountCents;
    const requestedAmount = amountCents ?? refundableAmount;
    const clampedAmount = Math.min(requestedAmount, refundableAmount);
    const now = new Date();
    const fromOrderRefundStatus = order.refundStatus;

    await tx.order.update({
      where: { id: order.id },
      data: { refundStatus: OrderRefundStatus.PENDING },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundStatus: OrderRefundStatus.PENDING,
        refundRequestedAt: payment.refundRequestedAt ?? now,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderActorType.SYSTEM,
        actorId,
        actorLabel,
        eventType: "ORDER_REFUND_REQUESTED",
        fromPaymentStatus: order.paymentStatus,
        toPaymentStatus: order.paymentStatus,
        message: "Paid order refund requested through Clover.",
        metadata: {
          paymentId: payment.id,
          amountCents: clampedAmount,
          fromRefundStatus: fromOrderRefundStatus,
          toRefundStatus: OrderRefundStatus.PENDING,
        },
      },
    });

    return { order, payment, amountCents: clampedAmount };
  });

  const result = await refundCloverPayment({
    payment: prepared.payment,
    amountCents: prepared.amountCents,
  });
  const nextRefundStatus = refundStatusForResult(result);

  const updated = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: prepared.payment.id },
    });
    const order = await tx.order.findUniqueOrThrow({
      where: { id: prepared.order.id },
    });
    const nextPaymentStatus = paymentStatusForRefund({
      result,
      payment,
      amountCents: prepared.amountCents,
    });
    const refundedAmountCents =
      nextPaymentStatus === OrderPaymentStatus.REFUNDED ||
      nextPaymentStatus === OrderPaymentStatus.PARTIALLY_REFUNDED
        ? Math.min(payment.amountCents, payment.refundedAmountCents + prepared.amountCents)
        : payment.refundedAmountCents;
    const now = new Date();

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: nextPaymentStatus,
        refundStatus: nextRefundStatus,
        refundedAmountCents,
        refundedAt:
          nextRefundStatus === OrderRefundStatus.SUCCEEDED
            ? payment.refundedAt ?? now
            : payment.refundedAt,
        rawProviderData: toPrismaJson({
          previous: payment.rawProviderData ?? null,
          latestRefund: result,
        }),
      },
    });
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: nextPaymentStatus,
        refundStatus: nextRefundStatus,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorType: OrderActorType.SYSTEM,
        actorId,
        actorLabel,
        eventType: result.failed
          ? "ORDER_REFUND_FAILED"
          : result.pending
            ? "ORDER_REFUND_PENDING"
            : "ORDER_REFUND_COMPLETED",
        fromPaymentStatus: order.paymentStatus,
        toPaymentStatus: nextPaymentStatus,
        message: result.failed
          ? "Clover refund failed. Manual follow-up is required."
          : result.pending
            ? "Clover refund is pending."
            : "Clover refund completed.",
        metadata: toPrismaJson({
          paymentId: payment.id,
          amountCents: prepared.amountCents,
          refundStatus: nextRefundStatus,
          providerRefundId: result.providerRefundId,
          providerPaymentId: result.providerPaymentId,
          providerOrderId: result.providerOrderId,
          idempotencyKey: result.idempotencyKey,
          rawResponse: result.rawResponse,
        }),
      },
    });

    return { order: updatedOrder, payment: updatedPayment };
  });

  return { ...updated, refund: result };
}
