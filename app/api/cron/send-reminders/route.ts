import { timingSafeEqual } from "node:crypto";

import { ReservationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCronSecret } from "@/lib/env";
import { sendReservationReminderSms } from "@/lib/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REMINDER_TARGET_HOURS = 24;
const REMINDER_WINDOW_MINUTES = 30;
const MAX_REMINDERS_PER_RUN = 50;

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
  const halfWindow = REMINDER_WINDOW_MINUTES * 60 * 1000;

  return {
    gte: new Date(target - halfWindow),
    lt: new Date(target + halfWindow),
  };
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

  const window = reminderWindow();
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
    },
  });

  let sent = 0;
  let failed = 0;

  for (const reservation of reservations) {
    const result = await sendReservationReminderSms(reservation);

    if (!result.ok) {
      failed += 1;
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
        data: { reminderSentAt: new Date() },
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
      sent,
      failed,
      window: {
        from: window.gte.toISOString(),
        to: window.lt.toISOString(),
      },
    },
  });
}
