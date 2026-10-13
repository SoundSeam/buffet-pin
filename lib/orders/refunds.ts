import "server-only";

import {
  OrderActorType,
  OrderPaymentStatus,
  OrderRefundStatus,
  PaymentProvider,
  Prisma,
  RefundIntentStatus,
  type Payment,
} from "@prisma/client";
import { refundCloverPayment, type CloverRefundResult } from "@/lib/clover/refunds";
import { db } from "@/lib/db";
import { withSerializableRetry } from "@/lib/db-transactions";

export class OrderRefundError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "OrderRefundError"; }
}

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function latestRefundablePayment(payments: Payment[]) {
  return payments.find((payment) => payment.provider === PaymentProvider.CLOVER &&
    (payment.status === OrderPaymentStatus.PAID || payment.status === OrderPaymentStatus.PARTIALLY_REFUNDED) &&
    payment.amountCents > payment.refundedAmountCents) ?? null;
}

async function recomputeRefundState(
  tx: Prisma.TransactionClient,
  payment: Payment,
  preLedgerRefundedAmountCents: number,
) {
  const succeeded = await tx.refundIntent.aggregate({
    where: { paymentId: payment.id, status: RefundIntentStatus.SUCCEEDED },
    _sum: { amountCents: true },
  });
  const unresolved = await tx.refundIntent.count({
    where: {
      paymentId: payment.id,
      status: {
        in: [
          RefundIntentStatus.PENDING,
          RefundIntentStatus.SUBMITTING,
          RefundIntentStatus.UNKNOWN,
        ],
      },
    },
  });
  const refundedAmountCents = Math.min(
    payment.amountCents,
    preLedgerRefundedAmountCents + (succeeded._sum.amountCents ?? 0),
  );
  const paymentStatus = refundedAmountCents >= payment.amountCents
    ? OrderPaymentStatus.REFUNDED
    : refundedAmountCents > 0
      ? OrderPaymentStatus.PARTIALLY_REFUNDED
      : payment.status;
  const refundStatus = refundedAmountCents >= payment.amountCents
    ? OrderRefundStatus.SUCCEEDED
    : refundedAmountCents > 0
      ? OrderRefundStatus.PARTIAL
      : unresolved > 0
        ? OrderRefundStatus.PENDING
        : OrderRefundStatus.FAILED;
  return { refundedAmountCents, paymentStatus, refundStatus };
}

type RefundPreparationInput = {
  orderId: string;
  requestKey: string;
  reason: string;
  amountCents?: number;
  actorId: string;
  actorLabel?: string;
};

export async function prepareRefundIntentInTransaction(
  tx: Prisma.TransactionClient,
  input: RefundPreparationInput,
) {
  const replay = await tx.refundIntent.findUnique({ where: { requestKey: input.requestKey }, include: { payment: true, order: true } });
  if (replay) {
    if (replay.orderId !== input.orderId || (input.amountCents !== undefined && replay.amountCents !== input.amountCents)) {
      throw new OrderRefundError("IDEMPOTENCY_CONFLICT", "The refund request key was already used for different input.");
    }
    return { intent: replay, claimed: replay.status === RefundIntentStatus.PENDING };
  }

  const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { payments: { orderBy: { createdAt: "desc" } } } });
  if (!order) throw new OrderRefundError("ORDER_NOT_FOUND", "Order not found.");
  if (order.paymentStatus !== OrderPaymentStatus.PAID && order.paymentStatus !== OrderPaymentStatus.PARTIALLY_REFUNDED) {
    throw new OrderRefundError("ORDER_NOT_PAID", "Order is not refundable.");
  }
  let payment = latestRefundablePayment(order.payments);
  if (!payment) {
    payment = await tx.payment.create({ data: {
      orderId: order.id,
      provider: PaymentProvider.CLOVER,
      status: order.paymentStatus,
      refundStatus: OrderRefundStatus.REQUIRED,
      amountCents: order.totalCents,
      currency: "CAD",
      rawProviderData: { recoveryReason: "Paid order had no refundable payment record." },
    } });
  }
  await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
  const lockedPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
  const replayAfterLock = await tx.refundIntent.findUnique({ where: { requestKey: input.requestKey }, include: { payment: true, order: true } });
  if (replayAfterLock) {
    if (replayAfterLock.orderId !== input.orderId || (input.amountCents !== undefined && replayAfterLock.amountCents !== input.amountCents)) throw new OrderRefundError("IDEMPOTENCY_CONFLICT", "The refund request key was already used for different input.");
    return { intent: replayAfterLock, claimed: replayAfterLock.status === RefundIntentStatus.PENDING };
  }
  const reserved = await tx.refundIntent.aggregate({ where: { paymentId: payment.id, status: { in: [RefundIntentStatus.PENDING, RefundIntentStatus.SUBMITTING, RefundIntentStatus.UNKNOWN, RefundIntentStatus.REQUIRES_REVIEW] } }, _sum: { amountCents: true } });
  const available = lockedPayment.amountCents - lockedPayment.refundedAmountCents - (reserved._sum.amountCents ?? 0);
  if (available <= 0) throw new OrderRefundError("REFUND_ALREADY_RESERVED", "The remaining refundable amount is already refunded or reserved by an unresolved intent.");
  const amountCents = input.amountCents ?? available;
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > available) throw new OrderRefundError("INVALID_REFUND_AMOUNT", "Refund amount exceeds the remaining paid amount.");
  if (amountCents !== available) {
    const settings = await tx.restaurantOrderSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    if (!settings.partialRefundsEnabled) throw new OrderRefundError("PARTIAL_REFUNDS_DISABLED", "Partial refunds are disabled by policy.");
  }
  const requiresReview = !lockedPayment.providerPaymentId;
  const intent = await tx.refundIntent.create({ data: {
    requestKey: input.requestKey, orderId: order.id, paymentId: lockedPayment.id, amountCents, currency: lockedPayment.currency,
    reason: input.reason.trim(), actorId: input.actorId, actorLabel: input.actorLabel, providerIdempotencyKey: `refund:${input.requestKey}`,
    status: requiresReview ? RefundIntentStatus.REQUIRES_REVIEW : RefundIntentStatus.PENDING,
    lastErrorCode: requiresReview ? "PROVIDER_PAYMENT_ID_MISSING" : null,
    lastErrorMessage: requiresReview ? "Clover charge id is missing; reconcile the payment before refunding." : null,
    requestPayload: { charge: lockedPayment.providerPaymentId ?? null, amount: amountCents, reason: "requested_by_customer" },
  }, include: { payment: true, order: true } });
  await tx.order.update({ where: { id: order.id }, data: { refundStatus: OrderRefundStatus.PENDING } });
  await tx.payment.update({ where: { id: lockedPayment.id }, data: { refundStatus: OrderRefundStatus.PENDING, refundRequestedAt: lockedPayment.refundRequestedAt ?? new Date() } });
  await tx.orderEvent.create({ data: { orderId: order.id, actorType: OrderActorType.ADMIN, actorId: input.actorId, actorLabel: input.actorLabel, eventType: "ORDER_REFUND_REQUESTED", fromPaymentStatus: order.paymentStatus, toPaymentStatus: order.paymentStatus, message: input.reason.trim(), metadata: { refundIntentId: intent.id, requestKey: input.requestKey, amountCents } } });
  return { intent, claimed: !requiresReview };
}

/** Durable coordinator: persist intent, claim exactly once, call provider outside the transaction, finalize. */
export async function refundPaidOrder(input: RefundPreparationInput & {
  provider?: typeof refundCloverPayment;
}) {
  if (!input.requestKey.trim() || !input.reason.trim() || !input.actorId.trim()) {
    throw new OrderRefundError("REFUND_INPUT_REQUIRED", "Request key, reason, and actor are required.");
  }

  const prepareIntent = () => db.$transaction((tx) => prepareRefundIntentInTransaction(tx, input));
  let prepared: Awaited<ReturnType<typeof prepareIntent>>;
  try {
    prepared = await prepareIntent();
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const replay = await db.refundIntent.findUnique({ where: { requestKey: input.requestKey }, include: { payment: true, order: true } });
    if (!replay || replay.orderId !== input.orderId || (input.amountCents !== undefined && replay.amountCents !== input.amountCents)) {
      throw new OrderRefundError("IDEMPOTENCY_CONFLICT", "The refund request key was already used for different input.");
    }
    prepared = { intent: replay, claimed: replay.status === RefundIntentStatus.PENDING };
  }

  if (!prepared.claimed || prepared.intent.status !== RefundIntentStatus.PENDING) {
    return { order: prepared.intent.order, payment: prepared.intent.payment, intent: prepared.intent, refund: null, replayed: true };
  }

  const claim = await db.refundIntent.updateMany({
    where: { id: prepared.intent.id, status: RefundIntentStatus.PENDING },
    data: { status: RefundIntentStatus.SUBMITTING, attemptCount: { increment: 1 }, lastAttemptAt: new Date(), submittedAt: new Date() },
  });
  if (claim.count !== 1) {
    const intent = await db.refundIntent.findUniqueOrThrow({ where: { id: prepared.intent.id }, include: { order: true, payment: true } });
    return { order: intent.order, payment: intent.payment, intent, refund: null, replayed: true };
  }

  const refund = await (input.provider ?? refundCloverPayment)({ payment: prepared.intent.payment, amountCents: prepared.intent.amountCents, idempotencyKey: prepared.intent.providerIdempotencyKey });
  return finalizeRefund(prepared.intent.id, refund);
}

async function finalizeRefund(intentId: string, refund: CloverRefundResult) {
  return withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "RefundIntent" WHERE "id" = ${intentId} FOR UPDATE`;
    const intent = await tx.refundIntent.findUniqueOrThrow({ where: { id: intentId }, include: { order: true, payment: true } });
    if (intent.status === RefundIntentStatus.SUCCEEDED) return { order: intent.order, payment: intent.payment, intent, refund, replayed: true };
    if (intent.status !== RefundIntentStatus.SUBMITTING) return { order: intent.order, payment: intent.payment, intent, refund, replayed: true };
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${intent.paymentId} FOR UPDATE`;
    const lockedPayment = await tx.payment.findUniqueOrThrow({ where: { id: intent.paymentId } });
    const succeededBefore = await tx.refundIntent.aggregate({ where: { paymentId: intent.paymentId, status: RefundIntentStatus.SUCCEEDED }, _sum: { amountCents: true } });
    const preLedgerRefundedAmountCents = Math.max(0, lockedPayment.refundedAmountCents - (succeededBefore._sum.amountCents ?? 0));
    const status = refund.succeeded ? RefundIntentStatus.SUCCEEDED : refund.unknown ? RefundIntentStatus.UNKNOWN : RefundIntentStatus.FAILED;
    const now = new Date();
    const updatedIntent = await tx.refundIntent.update({ where: { id: intent.id }, data: {
      status, providerRefundId: refund.providerRefundId, providerResponse: json(refund.rawResponse),
      lastErrorCode: refund.errorCode, lastErrorMessage: refund.failed || refund.unknown ? String(refund.errorCode ?? "Provider outcome requires review") : null,
      resolvedAt: refund.succeeded || refund.failed ? now : null,
    } });
    const recomputed = await recomputeRefundState(tx, lockedPayment, preLedgerRefundedAmountCents);
    const orderRefundStatus = refund.unknown && recomputed.refundedAmountCents === 0
      ? OrderRefundStatus.PENDING
      : refund.failed && recomputed.refundedAmountCents === 0
        ? OrderRefundStatus.FAILED
        : recomputed.refundStatus;
    const payment = await tx.payment.update({ where: { id: intent.paymentId }, data: {
      status: recomputed.paymentStatus, refundStatus: orderRefundStatus, refundedAmountCents: recomputed.refundedAmountCents,
      refundedAt: recomputed.refundedAmountCents > 0 ? lockedPayment.refundedAt ?? now : lockedPayment.refundedAt,
      rawProviderData: json({ previous: intent.payment.rawProviderData ?? null, latestRefund: refund.rawResponse }),
    } });
    const order = await tx.order.update({ where: { id: intent.orderId }, data: { paymentStatus: recomputed.paymentStatus, refundStatus: orderRefundStatus } });
    await tx.orderEvent.create({ data: {
      orderId: intent.orderId, actorType: OrderActorType.SYSTEM, actorId: intent.actorId, actorLabel: intent.actorLabel,
      eventType: refund.succeeded ? "ORDER_REFUND_COMPLETED" : refund.unknown ? "ORDER_REFUND_UNKNOWN" : "ORDER_REFUND_FAILED",
      fromPaymentStatus: intent.order.paymentStatus, toPaymentStatus: recomputed.paymentStatus,
      message: refund.succeeded ? "Clover refund completed." : "Clover refund requires reconciliation.",
      metadata: { refundIntentId: intent.id, providerRefundId: refund.providerRefundId, errorCode: refund.errorCode, amountCents: intent.amountCents },
    } });
    return { order, payment, intent: updatedIntent, refund, replayed: false };
  });
}

export async function resolveRefundIntent(input: { intentId: string; succeeded: boolean; providerRefundId?: string; reason: string; actorId: string; actorLabel?: string }) {
  return withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "RefundIntent" WHERE "id" = ${input.intentId} FOR UPDATE`;
    const intent = await tx.refundIntent.findUnique({ where: { id: input.intentId }, include: { payment: true, order: true } });
    if (!intent) throw new OrderRefundError("REFUND_INTENT_NOT_FOUND", "Refund intent not found.");
    if (intent.status !== RefundIntentStatus.UNKNOWN && intent.status !== RefundIntentStatus.FAILED && intent.status !== RefundIntentStatus.REQUIRES_REVIEW) {
      throw new OrderRefundError("REFUND_NOT_RESOLVABLE", "Only unresolved refund intents can be reconciled manually.");
    }
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${intent.paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: intent.paymentId } });
    const succeededBefore = await tx.refundIntent.aggregate({ where: { paymentId: intent.paymentId, status: RefundIntentStatus.SUCCEEDED }, _sum: { amountCents: true } });
    const preLedgerRefundedAmountCents = Math.max(0, payment.refundedAmountCents - (succeededBefore._sum.amountCents ?? 0));
    const now = new Date();
    const changed = await tx.refundIntent.updateMany({ where: {
      id: intent.id,
      status: { in: [RefundIntentStatus.UNKNOWN, RefundIntentStatus.FAILED, RefundIntentStatus.REQUIRES_REVIEW] },
    }, data: {
      status: input.succeeded ? RefundIntentStatus.SUCCEEDED : RefundIntentStatus.REQUIRES_REVIEW,
      providerRefundId: input.providerRefundId, resolvedAt: input.succeeded ? now : null,
      lastErrorMessage: input.succeeded ? null : input.reason,
    } });
    if (changed.count !== 1) throw new OrderRefundError("REFUND_NOT_RESOLVABLE", "Refund intent changed while it was being reconciled.");
    const updated = await tx.refundIntent.findUniqueOrThrow({ where: { id: intent.id } });
    const recomputed = await recomputeRefundState(tx, payment, preLedgerRefundedAmountCents);
    const refundStatus = input.succeeded ? recomputed.refundStatus : OrderRefundStatus.FAILED;
    await tx.payment.update({ where: { id: intent.paymentId }, data: {
      status: recomputed.paymentStatus, refundStatus,
      refundedAmountCents: recomputed.refundedAmountCents,
      refundedAt: recomputed.refundedAmountCents > 0 ? payment.refundedAt ?? now : payment.refundedAt,
    } });
    await tx.order.update({ where: { id: intent.orderId }, data: { paymentStatus: recomputed.paymentStatus, refundStatus } });
    await tx.orderEvent.create({ data: {
      orderId: intent.orderId, actorType: OrderActorType.ADMIN, actorId: input.actorId, actorLabel: input.actorLabel,
      eventType: input.succeeded ? "ORDER_REFUND_RECONCILED_SUCCEEDED" : "ORDER_REFUND_REQUIRES_REVIEW",
      fromPaymentStatus: intent.order.paymentStatus, toPaymentStatus: recomputed.paymentStatus, message: input.reason,
      metadata: { refundIntentId: intent.id, providerRefundId: input.providerRefundId ?? null },
    } });
    return updated;
  });
}
