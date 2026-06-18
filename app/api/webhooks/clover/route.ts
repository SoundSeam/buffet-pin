import {
  OrderActorType,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  PaymentProvider,
  Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { notifyPaymentConfirmed } from "@/lib/orders/notifications";
import { getEnv } from "@/lib/env";
import {
  buildRawProviderData,
  getCloverSignatureHeader,
  nextFulfillmentStatus,
  nextPaymentStatus,
  normalizeCloverWebhook,
  parseCloverWebhookPayload,
  toPrismaJson,
  verifyCloverWebhookSignature,
} from "@/lib/clover/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function findMatchingPayment(
  tx: Prisma.TransactionClient,
  webhook: ReturnType<typeof normalizeCloverWebhook>,
) {
  if (webhook.checkoutSessionId) {
    const payment = await tx.payment.findUnique({
      where: { checkoutSessionId: webhook.checkoutSessionId },
      include: { order: true },
    });

    if (payment) {
      return payment;
    }
  }

  if (webhook.providerPaymentId) {
    const payment = await tx.payment.findUnique({
      where: { providerPaymentId: webhook.providerPaymentId },
      include: { order: true },
    });

    if (payment) {
      return payment;
    }
  }

  if (webhook.localPaymentId) {
    const payment = await tx.payment.findUnique({
      where: { id: webhook.localPaymentId },
      include: { order: true },
    });

    if (payment) {
      return payment;
    }
  }

  if (webhook.localOrderId) {
    const payment = await tx.payment.findFirst({
      where: {
        provider: PaymentProvider.CLOVER,
        orderId: webhook.localOrderId,
      },
      orderBy: { createdAt: "desc" },
      include: { order: true },
    });

    if (payment) {
      return payment;
    }
  }

  if (webhook.localOrderPublicCode) {
    const payment = await tx.payment.findFirst({
      where: {
        provider: PaymentProvider.CLOVER,
        order: { publicCode: webhook.localOrderPublicCode },
      },
      orderBy: { createdAt: "desc" },
      include: { order: true },
    });

    if (payment) {
      return payment;
    }
  }

  return null;
}

async function markEventProcessed(
  tx: Prisma.TransactionClient,
  eventId: string,
  paymentId: string | null,
) {
  await tx.paymentWebhookEvent.update({
    where: { id: eventId },
    data: {
      paymentId,
      processedAt: new Date(),
    },
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureResult = verifyCloverWebhookSignature({
    rawBody,
    signatureHeader: getCloverSignatureHeader(request.headers),
    secret: getEnv().CLOVER_WEBHOOK_SECRET,
  });

  if (!signatureResult.ok) {
    const status = signatureResult.code === "MISSING_SECRET" ? 503 : 401;

    return jsonResponse(status, {
      ok: false,
      error: { code: signatureResult.code, message: signatureResult.message },
    });
  }

  const parseResult = parseCloverWebhookPayload(rawBody);

  if (!parseResult.ok) {
    return jsonResponse(400, {
      ok: false,
      error: { code: parseResult.code, message: parseResult.message },
    });
  }

  const webhook = normalizeCloverWebhook(parseResult.payload);
  let eventId: string;

  try {
    const event = await db.paymentWebhookEvent.create({
      data: {
        provider: PaymentProvider.CLOVER,
        providerEventId: webhook.providerEventId,
        eventType: webhook.eventType,
        checkoutSessionId: webhook.checkoutSessionId,
        providerPaymentId: webhook.providerPaymentId,
        payload: toPrismaJson(webhook.payload),
      },
    });

    eventId = event.id;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await db.paymentWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: PaymentProvider.CLOVER,
          providerEventId: webhook.providerEventId,
        },
      },
    });

    return jsonResponse(200, {
      ok: true,
      duplicate: true,
      processed: Boolean(existing?.processedAt),
    });
  }

  const result = await db.$transaction(async (tx) => {
    const payment = await findMatchingPayment(tx, webhook);

    if (!payment) {
      await markEventProcessed(tx, eventId, null);

      return {
        matched: false,
        orderId: null,
        paymentChangedToPaid: false,
        paymentStatus: null,
        fulfillmentStatus: null,
      };
    }

    const fromPaymentStatus = payment.status;
    const fromOrderPaymentStatus = payment.order.paymentStatus;
    const fromFulfillmentStatus = payment.order.fulfillmentStatus;
    const toPaymentStatus = nextPaymentStatus(fromPaymentStatus, webhook.paymentStatus);
    const toOrderPaymentStatus = nextPaymentStatus(
      fromOrderPaymentStatus,
      webhook.paymentStatus,
    );
    const toFulfillmentStatus = nextFulfillmentStatus({
      paymentStatus: toOrderPaymentStatus,
      fulfillmentStatus: fromFulfillmentStatus,
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: toPaymentStatus,
        providerPaymentId: payment.providerPaymentId ?? webhook.providerPaymentId,
        providerOrderId: payment.providerOrderId ?? webhook.providerOrderId,
        paidAt:
          toPaymentStatus === OrderPaymentStatus.PAID
            ? payment.paidAt ?? webhook.paidAt ?? new Date()
            : payment.paidAt,
        failedAt:
          toPaymentStatus === OrderPaymentStatus.FAILED
            ? payment.failedAt ?? webhook.failedAt ?? new Date()
            : payment.failedAt,
        failureCode:
          toPaymentStatus === OrderPaymentStatus.FAILED
            ? webhook.failureCode ?? payment.failureCode
            : payment.failureCode,
        failureMessage:
          toPaymentStatus === OrderPaymentStatus.FAILED
            ? webhook.failureMessage ?? payment.failureMessage
            : payment.failureMessage,
        rawProviderData: buildRawProviderData(payment, webhook),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: toOrderPaymentStatus,
        fulfillmentStatus: toFulfillmentStatus,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: payment.orderId,
        actorType: OrderActorType.WEBHOOK,
        actorLabel: "Clover",
        eventType:
          toOrderPaymentStatus === OrderPaymentStatus.PAID
            ? "CLOVER_PAYMENT_PAID"
            : toOrderPaymentStatus === OrderPaymentStatus.FAILED
              ? "CLOVER_PAYMENT_FAILED"
              : "CLOVER_PAYMENT_WEBHOOK_RECONCILED",
        fromPaymentStatus: fromOrderPaymentStatus,
        toPaymentStatus: toOrderPaymentStatus,
        fromFulfillmentStatus,
        toFulfillmentStatus,
        message:
          toOrderPaymentStatus === OrderPaymentStatus.PAID &&
          fromFulfillmentStatus === OrderFulfillmentStatus.AWAITING_PAYMENT &&
          toFulfillmentStatus === OrderFulfillmentStatus.AWAITING_ACCEPTANCE
            ? "Clover payment approved. Order is awaiting admin acceptance."
            : "Clover payment webhook reconciled.",
        metadata: {
          paymentId: payment.id,
          webhookEventId: eventId,
          providerEventId: webhook.providerEventId,
          checkoutSessionId: webhook.checkoutSessionId,
          providerPaymentId: webhook.providerPaymentId,
          providerOrderId: webhook.providerOrderId,
          providerStatus: webhook.paymentStatus,
        },
      },
    });

    await markEventProcessed(tx, eventId, payment.id);

    return {
      matched: true,
      orderId: payment.orderId,
      paymentChangedToPaid:
        fromOrderPaymentStatus !== OrderPaymentStatus.PAID &&
        toOrderPaymentStatus === OrderPaymentStatus.PAID,
      paymentStatus: toOrderPaymentStatus,
      fulfillmentStatus: toFulfillmentStatus,
    };
  });

  if (result.orderId && result.paymentChangedToPaid) {
    await notifyPaymentConfirmed(result.orderId);
  }

  return jsonResponse(200, {
    ok: true,
    duplicate: false,
    data: result,
  });
}
