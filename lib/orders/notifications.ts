import "server-only";

import {
  NotificationChannel,
  NotificationStatus,
  OrderFulfillmentStatus,
  Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/env";
import {
  orderNotificationTemplateKeys,
  renderOrderNotificationSms,
  renderRefundFailedAdminSms,
  templateKeyForFulfillmentStatus,
  type OrderNotificationTemplateKey,
} from "@/lib/orders/notification-templates";
import { sendSms } from "@/lib/sms";

const POSITIVE_TWILIO_STATUSES = new Set(["queued", "accepted", "sending", "sent", "delivered"]);

type NotificationSendResult = {
  id: string;
  status: NotificationStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
};

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function statusCallbackUrl(): string {
  return new URL("/api/twilio/message-status", getAppUrl()).toString();
}

async function createAndSendSmsNotification({
  orderId,
  customerId,
  recipient,
  templateKey,
  body,
  metadata,
}: {
  orderId?: string | null;
  customerId?: string | null;
  recipient: string | null | undefined;
  templateKey: OrderNotificationTemplateKey;
  body: string;
  metadata?: unknown;
}): Promise<NotificationSendResult | null> {
  if (!recipient) {
    return null;
  }

  try {
    const notification = await db.notification.create({
      data: {
        orderId,
        customerId,
        recipient,
        channel: NotificationChannel.SMS,
        templateKey,
        body,
        status: NotificationStatus.PENDING,
        provider: "twilio",
        metadata: metadata === undefined ? undefined : toPrismaJson(metadata),
      },
    });

    const result = await sendSms(recipient, body, { statusCallback: statusCallbackUrl() });

    if (result.ok) {
      const nextStatus = POSITIVE_TWILIO_STATUSES.has(result.status.toLowerCase())
        ? NotificationStatus.SENT
        : NotificationStatus.PENDING;
      const updated = await db.notification.update({
        where: { id: notification.id },
        data: {
          providerMessageId: result.sid,
          status: nextStatus,
          sentAt: nextStatus === NotificationStatus.SENT ? new Date() : null,
        },
      });

      return {
        id: updated.id,
        status: updated.status,
        providerMessageId: updated.providerMessageId,
        errorMessage: updated.errorMessage,
      };
    }

    const updated = await db.notification.update({
      where: { id: notification.id },
      data: {
        status: result.skipped ? NotificationStatus.SKIPPED : NotificationStatus.FAILED,
        failedAt: result.skipped ? null : new Date(),
        errorMessage: errorMessage(result.error),
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      providerMessageId: updated.providerMessageId,
      errorMessage: updated.errorMessage,
    };
  } catch (error) {
    console.error("Order notification failed.", error);
    return null;
  }
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
) {
  const order = await getOrderForNotification(orderId).catch((error) => {
    console.error("Unable to load order for notification.", error);
    return null;
  });

  if (!order) {
    return null;
  }

  return createAndSendSmsNotification({
    orderId: order.id,
    customerId: order.customerId,
    recipient: order.customerPhone,
    templateKey,
    body: renderOrderNotificationSms(templateKey, {
      publicCode: order.publicCode,
      serviceType: order.serviceType,
      language: order.customer.language,
      customerName: order.customerName,
      estimatedReadyEndAt: order.estimatedReadyEndAt,
      estimatedDeliveryEndAt: order.estimatedDeliveryEndAt,
      rejectionReason: order.rejectionReason,
      driverName: order.driverAssignment?.driver.name,
    }),
    metadata,
  });
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
      publicCode: order.publicCode,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalCents: order.totalCents,
      errorMessage: error ? errorMessage(error) : null,
    }),
    metadata: { alertType: "refund_failed" },
  });
}
