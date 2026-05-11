import type { ReservationLanguage } from "@prisma/client";
import twilio from "twilio";

import { getSmsConfig } from "./env";
import { buildManageUrl } from "./reservations/manage-link";
import { renderConfirmationSms, renderReminderSms } from "./sms-templates";

type SmsReservation = {
  id: string;
  confirmationCode: string;
  manageToken: string;
  reservationAt: Date;
  partySize: number;
  guestPhone: string;
  language: ReservationLanguage;
};

type SmsSendResult =
  | { ok: true; sid: string }
  | { ok: false; error: unknown; skipped?: boolean };

let cachedClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  const config = getSmsConfig();

  if (!config) {
    return null;
  }

  cachedClient ??= twilio(config.accountSid, config.authToken);
  return { client: cachedClient, from: config.from };
}

export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  const twilioClient = getTwilioClient();

  if (!twilioClient) {
    return {
      ok: false,
      skipped: true,
      error: new Error("Twilio SMS is disabled."),
    };
  }

  try {
    const message = await twilioClient.client.messages.create({
      to,
      from: twilioClient.from,
      body,
    });

    return { ok: true, sid: message.sid };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function sendReservationConfirmationSms(
  reservation: SmsReservation,
): Promise<SmsSendResult> {
  return sendSms(
    reservation.guestPhone,
    renderConfirmationSms({
      language: reservation.language,
      reservationAt: reservation.reservationAt,
      partySize: reservation.partySize,
      confirmationCode: reservation.confirmationCode,
      manageUrl: buildManageUrl(reservation.manageToken),
    }),
  );
}

export async function sendReservationReminderSms(
  reservation: SmsReservation,
): Promise<SmsSendResult> {
  return sendSms(
    reservation.guestPhone,
    renderReminderSms({
      language: reservation.language,
      reservationAt: reservation.reservationAt,
      partySize: reservation.partySize,
      confirmationCode: reservation.confirmationCode,
      manageUrl: buildManageUrl(reservation.manageToken),
    }),
  );
}
