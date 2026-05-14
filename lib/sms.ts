import type { ReservationLanguage } from "@prisma/client";
import twilio from "twilio";

import { getAppUrl, getSmsConfig } from "./env";
import { buildManageUrl } from "./reservations/manage-link";
import {
  renderAdminNewReservationSms,
  renderConfirmationSms,
  renderReminderSms,
} from "./sms-templates";

const ADMIN_RESERVATION_SMS_TO = "+15148872002";

type SmsReservation = {
  id: string;
  confirmationCode: string;
  manageToken: string;
  reservationAt: Date;
  partySize: number;
  guestPhone: string;
  language: ReservationLanguage;
};

type AdminReservationAlert = {
  reservationAt: Date;
  partySize: number;
  guestName: string;
  guestPhone: string;
};

type SmsSendResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; error: unknown; skipped?: boolean };

type SmsSendOptions = {
  statusCallback?: string;
};

let cachedClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  const config = getSmsConfig();

  if (!config) {
    return null;
  }

  cachedClient ??= twilio(config.accountSid, config.authToken);
  return { client: cachedClient, from: config.from };
}

function buildReminderStatusCallbackUrl(): string {
  return new URL("/api/twilio/message-status", getAppUrl()).toString();
}

export async function sendSms(
  to: string,
  body: string,
  options?: SmsSendOptions,
): Promise<SmsSendResult> {
  let twilioClient: ReturnType<typeof getTwilioClient>;

  try {
    twilioClient = getTwilioClient();
  } catch (error) {
    return { ok: false, error };
  }

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
      ...(options?.statusCallback ? { statusCallback: options.statusCallback } : {}),
    });

    return { ok: true, sid: message.sid, status: message.status };
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
      manageUrl: buildManageUrl(reservation.manageToken),
    }),
    { statusCallback: buildReminderStatusCallbackUrl() },
  );
}

export async function sendAdminNewReservationSms(
  reservation: AdminReservationAlert,
): Promise<SmsSendResult> {
  return sendSms(
    ADMIN_RESERVATION_SMS_TO,
    renderAdminNewReservationSms(reservation),
  );
}
