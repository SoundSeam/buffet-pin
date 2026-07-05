import type { ReservationLanguage } from "@prisma/client";

import { BUSINESS_TIME_ZONE } from "./reservations/time";

const RESTAURANT_NAME = "Buffet PIN";

type ReservationSmsInput = {
  language: ReservationLanguage;
  reservationAt: Date;
  partySize: number;
  manageUrl: string;
};

type AdminReservationSmsInput = {
  reservationAt: Date;
  partySize: number;
  guestName: string;
  guestPhone: string;
};

type AdminReservationUpdateSmsInput = AdminReservationSmsInput & {
  previousReservationAt: Date;
  previousPartySize: number;
  previousGuestName: string;
  previousGuestPhone: string;
  previousGuestEmail: string | null;
  previousSpecialRequests: string | null;
  guestEmail: string | null;
  specialRequests: string | null;
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

function formatAdminReservationDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
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

export function renderAdminNewReservationSms(
  input: AdminReservationSmsInput,
): string {
  return [
    "New reservation",
    `Time: ${formatAdminReservationDateTime(input.reservationAt)}`,
    `Group size: ${input.partySize}`,
    `Name: ${input.guestName}`,
    `Phone: ${input.guestPhone}`,
  ].join("\n");
}

export function renderAdminReservationUpdatedSms(
  input: AdminReservationUpdateSmsInput,
): string {
  const changes = [
    input.previousReservationAt.getTime() !== input.reservationAt.getTime()
      ? "time"
      : null,
    input.previousPartySize !== input.partySize ? "group size" : null,
    input.previousGuestName !== input.guestName ? "name" : null,
    input.previousGuestPhone !== input.guestPhone ? "phone" : null,
    input.previousGuestEmail !== input.guestEmail ? "email" : null,
    input.previousSpecialRequests !== input.specialRequests ? "requests" : null,
  ].filter(Boolean);

  return [
    "Reservation modified by guest",
    `Changes: ${changes.length > 0 ? changes.join(", ") : "details updated"}`,
    `Time: ${formatAdminReservationDateTime(input.reservationAt)}`,
    `Group size: ${input.partySize}`,
    `Name: ${input.guestName}`,
    `Phone: ${input.guestPhone}`,
  ].join("\n");
}

export function renderAdminReservationCancelledSms(
  input: AdminReservationSmsInput,
): string {
  return [
    "Reservation cancelled by guest",
    `Time: ${formatAdminReservationDateTime(input.reservationAt)}`,
    `Group size: ${input.partySize}`,
    `Name: ${input.guestName}`,
    `Phone: ${input.guestPhone}`,
  ].join("\n");
}
