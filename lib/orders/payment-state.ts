import { OrderPaymentStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { withSerializableRetry } from "@/lib/db-transactions";

export async function failPendingPaymentInTransaction(
  tx: Prisma.TransactionClient,
  orderId: string,
  paymentId: string,
) {
  const order = await tx.order.updateMany({
    where: { id: orderId, paymentStatus: OrderPaymentStatus.PENDING },
    data: { paymentStatus: OrderPaymentStatus.FAILED },
  });
  if (order.count === 0) return false;
  const payment = await tx.payment.updateMany({
    where: { id: paymentId, orderId, status: OrderPaymentStatus.PENDING },
    data: { status: OrderPaymentStatus.FAILED, failedAt: new Date() },
  });
  if (payment.count !== 1) throw new Error("Order/payment status was inconsistent.");
  return true;
}

export async function confirmPaymentInTransaction(
  tx: Prisma.TransactionClient,
  orderId: string,
  paymentId: string,
  paidAt = new Date(),
) {
  const order = await tx.order.updateMany({
    where: {
      id: orderId,
      paymentStatus: { in: [OrderPaymentStatus.PENDING, OrderPaymentStatus.FAILED] },
    },
    data: { paymentStatus: OrderPaymentStatus.PAID },
  });
  if (order.count === 0) return false;
  const payment = await tx.payment.updateMany({
    where: {
      id: paymentId,
      orderId,
      status: { in: [OrderPaymentStatus.PENDING, OrderPaymentStatus.FAILED] },
    },
    data: { status: OrderPaymentStatus.PAID, paidAt, failedAt: null },
  });
  if (payment.count !== 1) throw new Error("Order/payment status was inconsistent.");
  return true;
}

export function failPendingPayment(client: PrismaClient, orderId: string, paymentId: string) {
  return withSerializableRetry(client, (tx) =>
    failPendingPaymentInTransaction(tx, orderId, paymentId),
  );
}

export function confirmPayment(client: PrismaClient, orderId: string, paymentId: string) {
  return withSerializableRetry(client, (tx) =>
    confirmPaymentInTransaction(tx, orderId, paymentId),
  );
}
