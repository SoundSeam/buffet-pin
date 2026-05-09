import type { PrismaClient, Settings } from "@prisma/client";

import { hasCapacityForParty } from "./capacity";
import { isDinnerSlotForSettings } from "./slots";
import {
  dateOnlyToUtcDate,
  guestModifyCutoffAt,
  isBeforeGuestModifyCutoff,
  isLocalDateInPast,
} from "./time";

export type ReservationRuleCode =
  | "INVALID_SLOT"
  | "INVALID_PARTY_SIZE"
  | "PAST_DATE"
  | "CLOSED_DATE"
  | "MODIFY_CUTOFF_PASSED"
  | "INSUFFICIENT_CAPACITY";

export class ReservationRuleError extends Error {
  constructor(
    public readonly code: ReservationRuleCode,
    message: string,
  ) {
    super(message);
    this.name = "ReservationRuleError";
  }
}

type RulesSettings = Pick<
  Settings,
  | "firstSlot"
  | "lastSlot"
  | "slotIntervalMinutes"
  | "minPartySize"
  | "maxPartySize"
  | "guestModifyCutoffHours"
  | "slotCapacityGuests"
>;

type ClosureDb = Pick<PrismaClient, "closureDate">;
type CapacityDb = Pick<PrismaClient, "reservation">;
type RulesDb = ClosureDb & CapacityDb;

export function assertDinnerOnlySlot(
  settings: Pick<RulesSettings, "firstSlot" | "lastSlot" | "slotIntervalMinutes">,
  reservationTime: string,
): void {
  if (!isDinnerSlotForSettings(reservationTime, settings)) {
    throw new ReservationRuleError(
      "INVALID_SLOT",
      "Online reservations are only available for configured dinner slots.",
    );
  }
}

export function assertPartySize(
  settings: Pick<RulesSettings, "minPartySize" | "maxPartySize">,
  partySize: number,
): void {
  if (partySize < settings.minPartySize || partySize > settings.maxPartySize) {
    throw new ReservationRuleError(
      "INVALID_PARTY_SIZE",
      `Party size must be between ${settings.minPartySize} and ${settings.maxPartySize}.`,
    );
  }
}

export function assertDateIsNotPast(
  reservationDate: string,
  now = new Date(),
): void {
  if (isLocalDateInPast(reservationDate, now)) {
    throw new ReservationRuleError(
      "PAST_DATE",
      "Reservation date cannot be in the past.",
    );
  }
}

export async function isDateClosed(
  db: ClosureDb,
  reservationDate: string,
): Promise<boolean> {
  const closure = await db.closureDate.findUnique({
    where: {
      date: dateOnlyToUtcDate(reservationDate),
    },
    select: {
      id: true,
    },
  });

  return Boolean(closure);
}

export async function assertDateIsOpen(
  db: ClosureDb,
  reservationDate: string,
): Promise<void> {
  if (await isDateClosed(db, reservationDate)) {
    throw new ReservationRuleError(
      "CLOSED_DATE",
      "Reservation date is closed.",
    );
  }
}

export function assertBeforeGuestModifyCutoff(
  settings: Pick<RulesSettings, "guestModifyCutoffHours">,
  reservationAt: Date,
  now = new Date(),
): void {
  if (
    !isBeforeGuestModifyCutoff(
      reservationAt,
      settings.guestModifyCutoffHours,
      now,
    )
  ) {
    throw new ReservationRuleError(
      "MODIFY_CUTOFF_PASSED",
      "Reservation can no longer be modified or cancelled online.",
    );
  }
}

export function getGuestModifyCutoff(
  settings: Pick<RulesSettings, "guestModifyCutoffHours">,
  reservationAt: Date,
): Date {
  return guestModifyCutoffAt(reservationAt, settings.guestModifyCutoffHours);
}

export async function assertCapacityForParty(
  db: CapacityDb,
  settings: Pick<RulesSettings, "slotCapacityGuests">,
  query: {
    reservationDate: string;
    reservationTime: string;
    partySize: number;
    excludeReservationId?: string;
  },
): Promise<void> {
  const hasCapacity = await hasCapacityForParty(db, settings, query);

  if (!hasCapacity) {
    throw new ReservationRuleError(
      "INSUFFICIENT_CAPACITY",
      "Not enough capacity remains for this reservation slot.",
    );
  }
}

export async function assertPublicBookingRules(
  db: RulesDb,
  settings: RulesSettings,
  query: {
    reservationDate: string;
    reservationTime: string;
    partySize: number;
    now?: Date;
  },
): Promise<void> {
  assertDinnerOnlySlot(settings, query.reservationTime);
  assertPartySize(settings, query.partySize);
  assertDateIsNotPast(query.reservationDate, query.now);
  await assertDateIsOpen(db, query.reservationDate);
  await assertCapacityForParty(db, settings, query);
}

export async function assertPublicUpdateRules(
  db: RulesDb,
  settings: RulesSettings,
  query: {
    reservationId: string;
    reservationDate: string;
    reservationTime: string;
    reservationAt: Date;
    partySize: number;
    now?: Date;
  },
): Promise<void> {
  assertBeforeGuestModifyCutoff(settings, query.reservationAt, query.now);
  assertDinnerOnlySlot(settings, query.reservationTime);
  assertPartySize(settings, query.partySize);
  assertDateIsNotPast(query.reservationDate, query.now);
  await assertDateIsOpen(db, query.reservationDate);
  await assertCapacityForParty(db, settings, {
    reservationDate: query.reservationDate,
    reservationTime: query.reservationTime,
    partySize: query.partySize,
    excludeReservationId: query.reservationId,
  });
}
