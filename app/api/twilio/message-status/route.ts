import { NextResponse } from "next/server";
import twilio from "twilio";

import { db } from "@/lib/db";
import { getSmsConfig } from "@/lib/env";
import { ensureReminderDeliveryTrackingSchema } from "@/lib/reservations/reminder-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POSITIVE_STATUSES = new Set(["sent", "delivered"]);
const FAILURE_STATUSES = new Set(["failed", "undelivered", "canceled"]);

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

  return NextResponse.json({ ok: true });
}
