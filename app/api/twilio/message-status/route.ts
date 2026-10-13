import { NextResponse } from "next/server";
import { NotificationStatus, OrderActorType } from "@prisma/client";
import twilio from "twilio";

import { db } from "@/lib/db";
import { getSmsConfig } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POSITIVE_STATUSES = new Set(["sent", "delivered"]);
const FAILURE_STATUSES = new Set(["failed", "undelivered", "canceled"]);

function notificationStatusForTwilioStatus(status: string): NotificationStatus {
  if (status === "delivered") return NotificationStatus.DELIVERED;
  if (POSITIVE_STATUSES.has(status)) return NotificationStatus.SENT;
  if (FAILURE_STATUSES.has(status)) return NotificationStatus.FAILED;
  return NotificationStatus.PENDING;
}

function jsonResponse(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function toTwilioParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }

  return params;
}

function isAuthorized(request: Request, params: Record<string, string>): boolean {
  const config = getSmsConfig();

  if (!config) {
    return false;
  }

  const signature = request.headers.get("x-twilio-signature");

  if (!signature) {
    return false;
  }

  return twilio.validateRequest(config.authToken, signature, request.url, params);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const params = toTwilioParams(formData);

  if (!isAuthorized(request, params)) {
    return jsonResponse(401, {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Invalid Twilio signature." },
    });
  }

  const sid = params.MessageSid;
  const status = params.MessageStatus?.toLowerCase();

  if (!sid || !status) {
    return jsonResponse(400, {
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: "Missing Twilio message status fields." },
    });
  }

  const data: {
    reminderStatus: string;
    reminderSentAt?: Date;
    reminderMessageSid?: string | null;
  } = {
    reminderStatus: status,
  };

  if (POSITIVE_STATUSES.has(status)) {
    data.reminderSentAt = new Date();
  }

  if (FAILURE_STATUSES.has(status)) {
    data.reminderMessageSid = null;
  }

  const firstUpdate = await db.reservation.updateMany({
    where: {
      reminderMessageSid: sid,
      ...(status === "delivered" ? {} : { reminderStatus: { not: "delivered" } }),
      ...(POSITIVE_STATUSES.has(status) ? { reminderSentAt: null } : {}),
    },
    data,
  });

  if (firstUpdate.count === 0) {
    await db.reservation.updateMany({
      where: { reminderMessageSid: sid, ...(status === "delivered" ? {} : { reminderStatus: { not: "delivered" } }) },
      data: { reminderStatus: status, ...(FAILURE_STATUSES.has(status) ? { reminderMessageSid: null } : {}) },
    });
  }

  const notificationStatus = notificationStatusForTwilioStatus(status);
  const notificationId = new URL(request.url).searchParams.get("notificationId")?.trim();
  await db.$transaction(async (tx) => {
    const notification = await tx.notification.findFirst({ where: notificationId ? { OR: [{ id: notificationId }, { providerMessageId: sid }] } : { providerMessageId: sid } });
    if (!notification) {
      await tx.operationalAlert.upsert({
        where: { alertKey: `unmatched-twilio-callback:${sid}` },
        create: { alertKey: `unmatched-twilio-callback:${sid}`, category: "NOTIFICATION_FAILED", severity: "CRITICAL", entityType: "NotificationCallback", entityId: sid, summary: "A valid Twilio status callback did not match a durable notification intent.", details: { providerStatus: status, notificationId: notificationId ?? null } },
        update: { status: "OPEN", severity: "CRITICAL", lastSeenAt: new Date(), resolvedAt: null, resolutionNote: null },
      });
      return;
    }
    if (notification.providerMessageId && notification.providerMessageId !== sid) {
      await tx.operationalAlert.upsert({
        where: { alertKey: `twilio-callback-sid-conflict:${notification.id}` },
        create: { alertKey: `twilio-callback-sid-conflict:${notification.id}`, category: "NOTIFICATION_FAILED", severity: "CRITICAL", entityType: "Notification", entityId: notification.id, summary: "Twilio callback SID conflicted with the notification provider identity." },
        update: { status: "OPEN", severity: "CRITICAL", lastSeenAt: new Date(), resolvedAt: null, resolutionNote: null },
      });
      return;
    }
    const changed = await tx.notification.updateMany({
      where: {
        id: notification.id,
      ...(notificationStatus === NotificationStatus.DELIVERED
        ? { status: { in: [NotificationStatus.PENDING, NotificationStatus.SUBMITTING, NotificationStatus.SENT, NotificationStatus.UNKNOWN] } }
        : notificationStatus === NotificationStatus.SENT
          ? { status: { in: [NotificationStatus.PENDING, NotificationStatus.SUBMITTING, NotificationStatus.UNKNOWN] } }
          : notificationStatus === NotificationStatus.FAILED
            ? { status: { in: [NotificationStatus.PENDING, NotificationStatus.SUBMITTING, NotificationStatus.SENT, NotificationStatus.UNKNOWN] } }
            : { status: { in: [NotificationStatus.PENDING, NotificationStatus.SUBMITTING] } }),
      },
      data: {
      providerMessageId: sid,
      status: notificationStatus,
      ...(notificationStatus === NotificationStatus.SENT ? { sentAt: new Date() } : {}),
      ...(notificationStatus === NotificationStatus.DELIVERED
        ? { deliveredAt: new Date(), sentAt: new Date() }
        : {}),
      ...(notificationStatus === NotificationStatus.FAILED
        ? {
            failedAt: new Date(),
            errorMessage:
              params.ErrorMessage ??
              params.ErrorCode ??
              `Twilio reported ${status}.`,
          }
        : {}),
      },
    });
    if (changed.count === 1) await tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.WEBHOOK, actorLabel: "Twilio", eventType: `NOTIFICATION_CALLBACK_${notificationStatus}`, entityType: "Notification", entityId: notification.id, metadata: { providerMessageId: sid, providerStatus: status, fromStatus: notification.status, toStatus: notificationStatus, errorCode: params.ErrorCode ?? null } } });
  });

  return NextResponse.json({ ok: true });
}
