import { timingSafeEqual } from "node:crypto";

import { ReservationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCronSecret } from "@/lib/env";
import { ensureReminderDeliveryTrackingSchema } from "@/lib/reservations/reminder-schema";
import { sendReservationReminderSms } from "@/lib/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REMINDER_TARGET_HOURS = 24;
const REMINDER_LOOKAHEAD_GRACE_MINUTES = 2;
const REMINDER_RETRY_WINDOW_MINUTES = 60;
const REMINDER_RETRY_COOLDOWN_MINUTES = 5;
const MAX_REMINDERS_PER_RUN = 50;
const TERMINAL_FAILURE_STATUSES = new Set(["failed", "undelivered", "canceled"]);
const IN_FLIGHT_STATUSES = new Set(["accepted", "queued", "sending"]);
const SUCCESS_STATUSES = new Set(["sent", "delivered"]);

function jsonResponse(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret();

  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  const expected = Buffer.from(secret);
  const actual = Buffer.from(token);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function reminderWindow(now = new Date()) {
  const target = now.getTime() + REMINDER_TARGET_HOURS * 60 * 60 * 1000;

  return {
    gte: new Date(target - REMINDER_RETRY_WINDOW_MINUTES * 60 * 1000),
    lt: new Date(target + REMINDER_LOOKAHEAD_GRACE_MINUTES * 60 * 1000),
  };
}

function canRetryAttemptedReminder(
  reminderStatus: string | null,
  reminderLastAttemptAt: Date | null,
  now: Date,
): boolean {
  if (!reminderStatus) {
    return true;
  }

  if (SUCCESS_STATUSES.has(reminderStatus) || IN_FLIGHT_STATUSES.has(reminderStatus)) {
    return false;
  }

  if (!TERMINAL_FAILURE_STATUSES.has(reminderStatus)) {
    return false;
  }

  if (!reminderLastAttemptAt) {
    return true;
  }

  return (
    now.getTime() - reminderLastAttemptAt.getTime() >=
    REMINDER_RETRY_COOLDOWN_MINUTES * 60 * 1000
  );
}

export async function GET(request: Request) {
  if (!getCronSecret()) {
    return jsonResponse(500, {
      ok: false,
      error: { code: "CRON_SECRET_MISSING", message: "Cron secret is not configured." },
    });
  }

  if (!isAuthorized(request)) {
    return jsonResponse(401, {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Invalid cron authorization." },
    });
  }

  await ensureReminderDeliveryTrackingSchema(db);

  const now = new Date();
  const window = reminderWindow(now);
  const reservations = await db.reservation.findMany({
    where: {
      status: ReservationStatus.CONFIRMED,
      reminderSentAt: null,
      reservationAt: window,
    },
    orderBy: { reservationAt: "asc" },
    take: MAX_REMINDERS_PER_RUN,
    select: {
      id: true,
      confirmationCode: true,
      manageToken: true,
      reservationAt: true,
      partySize: true,
      guestPhone: true,
      language: true,
      reminderLastAttemptAt: true,
      reminderStatus: true,
    },
  });

  const retryableReservations = reservations.filter((reservation) =>
    canRetryAttemptedReminder(reservation.reminderStatus, reservation.reminderLastAttemptAt, now),
  );

  let sent = 0;
  let failed = 0;

  for (const reservation of retryableReservations) {
    const result = await sendReservationReminderSms(reservation);

    if (!result.ok) {
      failed += 1;
      try {
        await db.reservation.update({
          where: { id: reservation.id },
          data: {
            reminderLastAttemptAt: new Date(),
            reminderMessageSid: null,
            reminderStatus: "failed",
          },
        });
      } catch (error) {
        console.error("Reservation reminder failure state update failed", {
          reservationId: reservation.id,
          error,
        });
      }
      console.error("Reservation reminder SMS failed", {
        reservationId: reservation.id,
        skipped: result.skipped ?? false,
        error: result.error,
      });
      continue;
    }

    try {
      await db.reservation.update({
        where: { id: reservation.id },
        data: {
          reminderLastAttemptAt: new Date(),
          reminderMessageSid: result.sid,
          reminderStatus: result.status,
        },
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("Reservation reminder SMS sent but timestamp update failed", {
        reservationId: reservation.id,
        error,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      selected: reservations.length,
      retryable: retryableReservations.length,
      sent,
      failed,
      window: {
        from: window.gte.toISOString(),
        to: window.lt.toISOString(),
      },
    },
  });
}
