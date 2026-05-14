import type { ReservationLanguage } from "@prisma/client";

import { BUSINESS_TIME_ZONE } from "./reservations/time";

const RESTAURANT_NAME = "Buffet PIN";

type ReservationSmsInput = {
  language: ReservationLanguage;
  reservationAt: Date;
  partySize: number;
  manageUrl: string;
};

function formatReservationDateTime(date: Date, language: ReservationLanguage): string {
  const locale = language === "FR" ? "fr-CA" : "en-CA";

  return new Intl.DateTimeFormat(locale, {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function renderConfirmationSms(input: ReservationSmsInput): string {
  const dateTime = formatReservationDateTime(input.reservationAt, input.language);

  if (input.language === "EN") {
    return `${RESTAURANT_NAME}: reservation confirmed for ${dateTime}, party of ${input.partySize}.\n\nManage: ${input.manageUrl}`;
  }

  return `${RESTAURANT_NAME} : réservation confirmée pour ${dateTime}, ${input.partySize} personnes.\n\nGérer : ${input.manageUrl}`;
}

export function renderReminderSms(input: ReservationSmsInput): string {
  const dateTime = formatReservationDateTime(input.reservationAt, input.language);

  if (input.language === "EN") {
    return `${RESTAURANT_NAME}: Friendly reminder! Looking forward to seeing you for your reservation ${dateTime}, party of ${input.partySize}.\n\nManage: ${input.manageUrl}`;
  }

  return `${RESTAURANT_NAME} : Petit rappel ! Hâte de vous voir pour votre réservation ${dateTime}, ${input.partySize} personnes.\n\nGérer : ${input.manageUrl}`;
}
