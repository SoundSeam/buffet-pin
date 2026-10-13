import "server-only";
import { createHash } from "node:crypto";

import {
  NotificationChannel,
  NotificationStatus,
  OperationalAlertSeverity,
  OrderActorType,
  OrderFulfillmentStatus,
  Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import {
  orderNotificationTemplateKeys,
  renderOrderNotificationSms,
  renderRefundFailedAdminSms,
  templateKeyForFulfillmentStatus,
  type OrderNotificationTemplateKey,
} from "@/lib/orders/notification-templates";
import { sendSms } from "@/lib/sms";

type NotificationSendResult = {
  id: string;
  status: NotificationStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
};

async function notificationResult(id: string): Promise<NotificationSendResult> {
  const notification = await db.notification.findUniqueOrThrow({ where: { id } });
  return { id: notification.id, status: notification.status, providerMessageId: notification.providerMessageId, errorMessage: notification.errorMessage };
}

export async function deliverNotification(
  id: string,
  allowedStatuses: NotificationStatus[] = [NotificationStatus.PENDING],
  sender: typeof sendSms = sendSms,
  emailSender: typeof sendEmail = sendEmail,
): Promise<NotificationSendResult> {
  const claimed = await db.$transaction(async (tx) => {
    const changed = await tx.notification.updateMany({
      where: { id, status: { in: allowedStatuses }, providerMessageId: null },
      data: { status: NotificationStatus.SUBMITTING, attemptCount: { increment: 1 }, lastAttemptAt: new Date(), errorMessage: null, failedAt: null },
    });
    if (changed.count === 1) await tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.SYSTEM, actorLabel: "Notification outbox", eventType: "NOTIFICATION_SUBMISSION_STARTED", entityType: "Notification", entityId: id } });
    return changed;
  });
  if (claimed.count !== 1) return notificationResult(id);
  const notification = await db.notification.findUniqueOrThrow({ where: { id } });
  try {
    const result = notification.channel === NotificationChannel.EMAIL
      ? await emailSender(
          notification.recipient,
          "Your Buffet PIN order update",
          notification.body,
          notification.id,
        )
      : await sender(notification.recipient, notification.body, { statusCallback: statusCallbackUrl(id) });
    if (result.ok) {
      const providerId = "sid" in result ? result.sid : result.id;
      const updated = await db.$transaction(async (tx) => {
        const changed = await tx.notification.updateMany({
          where: { id, status: NotificationStatus.SUBMITTING },
          data: { providerMessageId: providerId, status: NotificationStatus.SENT, sentAt: new Date() },
        });
        if (changed.count === 1) await tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.SYSTEM, actorLabel: "Notification outbox", eventType: "NOTIFICATION_ACCEPTED_BY_PROVIDER", entityType: "Notification", entityId: id, metadata: { providerMessageId: providerId, channel: notification.channel } } });
        return tx.notification.findUniqueOrThrow({ where: { id } });
      });
      return { id: updated.id, status: updated.status, providerMessageId: updated.providerMessageId, errorMessage: updated.errorMessage };
    }
    const targetStatus = result.skipped ? NotificationStatus.SKIPPED : deterministicTransportFailure(result.error) ? NotificationStatus.FAILED : NotificationStatus.UNKNOWN;
    const updated = await db.$transaction(async (tx) => {
      const changed = await tx.notification.updateMany({
        where: { id, status: NotificationStatus.SUBMITTING },
        data: {
        // A transport exception can happen after a provider accepted the message.
        // Never blindly resubmit an ambiguous notification; reconcile it first.
        status: targetStatus,
        failedAt: result.skipped ? null : new Date(),
        errorMessage: errorMessage(result.error),
        },
      });
      if (changed.count === 1) await tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.SYSTEM, actorLabel: "Notification outbox", eventType: `NOTIFICATION_SUBMISSION_${targetStatus}`, entityType: "Notification", entityId: id, metadata: { error: errorMessage(result.error) } } });
      return tx.notification.findUniqueOrThrow({ where: { id } });
    });
    return { id: updated.id, status: updated.status, providerMessageId: updated.providerMessageId, errorMessage: updated.errorMessage };
  } catch (error) {
    await db.$transaction(async (tx) => {
      const changed = await tx.notification.updateMany({
        where: { id, status: NotificationStatus.SUBMITTING },
        data: { status: NotificationStatus.UNKNOWN, failedAt: new Date(), errorMessage: errorMessage(error) },
      });
      if (changed.count === 1) await tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.SYSTEM, actorLabel: "Notification outbox", eventType: "NOTIFICATION_SUBMISSION_UNKNOWN", entityType: "Notification", entityId: id, metadata: { error: errorMessage(error) } } });
    });
    return notificationResult(id);
  }
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function deterministicTransportFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error && typeof error.status === "number" ? error.status : null;
  return status !== null && status >= 400 && status < 500 && ![408, 409, 429].includes(status);
}

function statusCallbackUrl(notificationId?: string): string {
  const url = new URL("/api/twilio/message-status", getAppUrl());
  if (notificationId) url.searchParams.set("notificationId", notificationId);
  return url.toString();
}

async function createNotificationIntent({
  orderId,
  customerId,
  recipient,
  templateKey,
  body,
  metadata,
  idempotencyKey,
  channel,
  provider,
}: {
  orderId?: string | null;
  customerId?: string | null;
  recipient: string | null | undefined;
  templateKey: OrderNotificationTemplateKey;
  body: string;
  metadata?: unknown;
  idempotencyKey?: string;
  channel: NotificationChannel;
  provider: string;
}): Promise<NotificationSendResult | null> {
  if (!recipient) {
    return null;
  }

  try {
    const stableKey = idempotencyKey ?? `order:${orderId ?? customerId ?? recipient}:${templateKey}:${channel.toLowerCase()}`;
    const notification = await db.notification.upsert({
      where: { idempotencyKey: stableKey },
      update: {},
      create: {
        orderId,
        customerId,
        recipient,
        channel,
        templateKey,
        idempotencyKey: stableKey,
        body,
        status: NotificationStatus.PENDING,
        provider,
        metadata: metadata === undefined ? undefined : toPrismaJson(metadata),
      },
    });
    if (notification.status === NotificationStatus.PENDING) {
      const { dispatchAggregateJobs } = await import("@/lib/async-jobs/dispatch");
      const dispatched = await dispatchAggregateJobs("Notification", notification.id);
      // Compatibility for local/test databases that have not applied the
      // transactional outbox migration yet.
      if (dispatched === 0) return deliverNotification(notification.id);
      return notificationResult(notification.id);
    }
    return notificationResult(notification.id);
  } catch (error) {
    console.error("Order notification failed.", error);
    const stableKey = idempotencyKey ?? `order:${orderId ?? customerId ?? recipient}:${templateKey}:${channel.toLowerCase()}`;
    const safeKey = createHash("sha256").update(stableKey).digest("hex").slice(0, 24);
    await db.operationalAlert.upsert({
      where: { alertKey: `notification-creation:${safeKey}` },
      create: { alertKey: `notification-creation:${safeKey}`, category: "NOTIFICATION_FAILED", severity: OperationalAlertSeverity.CRITICAL, entityType: orderId ? "Order" : "NotificationIntent", entityId: orderId ?? safeKey, summary: "A notification intent could not be durably recorded. Inspect configuration and retry from the source workflow." },
      update: { status: "OPEN", severity: OperationalAlertSeverity.CRITICAL, lastSeenAt: new Date(), resolvedAt: null, resolutionNote: null },
    }).catch((alertError) => console.error("Unable to persist notification creation alert.", alertError));
    return null;
  }
}

async function createAndSendSmsNotification(
  input: Omit<Parameters<typeof createNotificationIntent>[0], "channel" | "provider">,
) {
  return createNotificationIntent({
    ...input,
    channel: NotificationChannel.SMS,
    provider: "twilio",
  });
}

async function getOrderForNotification(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, language: true } },
      driverAssignment: { include: { driver: true } },
    },
  });
}

export async function notifyOrderTemplate(
  orderId: string,
  templateKey: OrderNotificationTemplateKey,
  metadata?: unknown,
  idempotencySuffix?: string,
) {
  const order = await getOrderForNotification(orderId).catch((error) => {
    console.error("Unable to load order for notification.", error);
    return null;
  });

  if (!order) {
    return null;
  }

  const body = renderOrderNotificationSms(templateKey, {
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      serviceType: order.serviceType,
      language: order.customer.language,
      customerName: order.customerName,
      estimatedReadyEndAt: order.estimatedReadyEndAt,
      estimatedDeliveryEndAt: order.estimatedDeliveryEndAt,
      rejectionReason: order.rejectionReason,
      driverName: order.driverAssignment?.driver.name,
    });
  return Promise.all([
    createNotificationIntent({
      orderId: order.id,
      customerId: order.customerId,
      recipient: order.customerPhone,
      templateKey,
      body,
      metadata,
      channel: NotificationChannel.SMS,
      provider: "twilio",
      ...(idempotencySuffix
        ? {
            idempotencyKey: `order:${order.id}:${templateKey}:sms:${idempotencySuffix}`,
          }
        : {}),
    }),
    createNotificationIntent({
      orderId: order.id,
      customerId: order.customerId,
      recipient: order.customerEmail,
      templateKey,
      body,
      metadata,
      channel: NotificationChannel.EMAIL,
      provider: "resend",
      ...(idempotencySuffix
        ? {
            idempotencyKey: `order:${order.id}:${templateKey}:email:${idempotencySuffix}`,
          }
        : {}),
    }),
  ]);
}

export async function notifyOrderFulfillmentStatus(
  orderId: string,
  status: OrderFulfillmentStatus,
  metadata?: unknown,
) {
  const templateKey = templateKeyForFulfillmentStatus(status);

  if (!templateKey) {
    return null;
  }

  return notifyOrderTemplate(orderId, templateKey, metadata);
}

export async function notifyPaymentConfirmed(orderId: string) {
  return notifyOrderTemplate(orderId, orderNotificationTemplateKeys.paymentConfirmed);
}

export async function notifyRejectedRefundPending(orderId: string) {
  return notifyOrderTemplate(
    orderId,
    orderNotificationTemplateKeys.rejectedRefundPending,
  );
}

export async function notifyCancelledRefundPending(orderId: string) {
  return notifyOrderTemplate(
    orderId,
    orderNotificationTemplateKeys.cancelledRefundPending,
  );
}

export async function notifyRefundSucceeded(orderId: string) {
  return notifyOrderTemplate(orderId, orderNotificationTemplateKeys.refundSucceeded);
}

export async function notifyRefundFailedAdminAlert({
  orderId,
  error,
}: {
  orderId: string;
  error?: unknown;
}) {
  const [order, settings] = await Promise.all([
    db.order.findUnique({ where: { id: orderId } }),
    db.restaurantOrderSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    }),
  ]).catch((caughtError) => {
    console.error("Unable to load refund alert notification inputs.", caughtError);
    return [null, null] as const;
  });

  if (!order || !settings.orderAdminSmsRecipient) {
    return null;
  }

  return createAndSendSmsNotification({
    orderId: order.id,
    customerId: order.customerId,
    recipient: settings.orderAdminSmsRecipient,
    templateKey: orderNotificationTemplateKeys.refundFailedAdminAlert,
    body: renderRefundFailedAdminSms({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalCents: order.totalCents,
      errorMessage: error ? errorMessage(error) : null,
    }),
    metadata: { alertType: "refund_failed" },
  });
}
