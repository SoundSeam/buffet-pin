import { NextResponse } from "next/server";
import { NotificationStatus } from "@prisma/client";
import twilio from "twilio";

import { db } from "@/lib/db";
import { getSmsConfig } from "@/lib/env";
import { ensureReminderDeliveryTrackingSchema } from "@/lib/reservations/reminder-schema";

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
  await ensureReminderDeliveryTrackingSchema(db);

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
      ...(POSITIVE_STATUSES.has(status) ? { reminderSentAt: null } : {}),
    },
    data,
  });

  if (firstUpdate.count === 0) {
    await db.reservation.updateMany({
      where: { reminderMessageSid: sid },
      data: { reminderStatus: status, ...(FAILURE_STATUSES.has(status) ? { reminderMessageSid: null } : {}) },
    });
  }

  const notificationStatus = notificationStatusForTwilioStatus(status);
  await db.notification.updateMany({
    where: { providerMessageId: sid },
    data: {
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

  return NextResponse.json({ ok: true });
}
