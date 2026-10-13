import "server-only";

import { ReservationStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { sendReservationReminderSms } from "@/lib/sms";

export async function deliverReservationReminder(reservationId: string) {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      confirmationCode: true,
      manageToken: true,
      status: true,
      reservationAt: true,
      partySize: true,
      guestPhone: true,
      language: true,
      reminderLastAttemptAt: true,
      reminderMessageSid: true,
      reminderStatus: true,
      reminderSentAt: true,
    },
  });
  if (!reservation || reservation.status !== ReservationStatus.CONFIRMED || reservation.reminderSentAt) {
    return { skipped: true, reason: "RESERVATION_NOT_REMINDER_ELIGIBLE" };
  }
  if (reservation.reminderMessageSid || ["accepted", "queued", "sending", "sent", "delivered"].includes(reservation.reminderStatus ?? "")) {
    return { skipped: true, reason: "REMINDER_ALREADY_SUBMITTED" };
  }

  const result = await sendReservationReminderSms(reservation);
  if (!result.ok) {
    await db.reservation.update({
      where: { id: reservation.id },
      data: {
        reminderLastAttemptAt: new Date(),
        reminderMessageSid: null,
        reminderStatus: result.skipped ? "skipped" : "failed",
      },
    });
    if (!result.skipped) throw result.error;
    return { skipped: true, reason: "SMS_DISABLED" };
  }

  await db.reservation.update({
    where: { id: reservation.id },
    data: {
      reminderLastAttemptAt: new Date(),
      reminderMessageSid: result.sid,
      reminderStatus: result.status,
    },
  });
  return { skipped: false, providerMessageId: result.sid };
}

