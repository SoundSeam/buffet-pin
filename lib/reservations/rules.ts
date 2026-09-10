import type {
  PrismaClient,
  Settings,
  SlotCapacitySetting,
} from "@prisma/client";

import { hasCapacityForParty } from "./capacity";
import { ONLINE_MIN_PARTY_SIZE, ONLINE_MAX_PARTY_SIZE } from "./party-size";
import { isReservationSlotForSettings } from "./slots";
import {
  dateOnlyToUtcDate,
  guestModifyCutoffAt,
  isBeforeGuestModifyCutoff,
  isReservationAtLeastLeadTimeAway,
  isLocalDateInPast,
  reservationAtFromLocalSlot,
  RESERVATION_LEAD_TIME_HOURS,
} from "./time";

export type ReservationRuleCode =
  | "RESERVATIONS_DISABLED"
  | "INVALID_SLOT"
  | "INVALID_PARTY_SIZE"
  | "PAST_DATE"
  | "CLOSED_DATE"
  | "BOOKING_LEAD_TIME"
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
> & {
  slotCapacities?: Pick<SlotCapacitySetting, "reservationTime" | "capacityGuests">[];
};

type ClosureDb = Pick<PrismaClient, "closureDate">;
type CapacityDb = Pick<PrismaClient, "reservation">;
type RulesDb = ClosureDb & CapacityDb;

export function assertReservationSlot(
  settings: Pick<RulesSettings, "firstSlot" | "lastSlot" | "slotIntervalMinutes">,
  reservationTime: string,
): void {
  if (!isReservationSlotForSettings(reservationTime, settings)) {
    throw new ReservationRuleError(
      "INVALID_SLOT",
      "Online reservations are only available during configured reservation hours.",
    );
  }
}

export function assertStaffPartySize(
  settings: Pick<RulesSettings, "minPartySize" | "maxPartySize">,
  partySize: number,
): void {
  // Staff must be able to manage the new small online bookings as well as
  // larger phone bookings admitted by their existing settings.
  if (
    Number.isInteger(partySize) &&
    partySize >= ONLINE_MIN_PARTY_SIZE &&
    partySize <= ONLINE_MAX_PARTY_SIZE
  ) return;
  if (
    !Number.isInteger(partySize) ||
    partySize < settings.minPartySize ||
    partySize > settings.maxPartySize
  ) {
    throw new ReservationRuleError(
      "INVALID_PARTY_SIZE",
      "This party size is outside the permitted reservation limits.",
    );
  }
}

export function assertPublicPartySize(partySize: number): void {
  if (
    !Number.isInteger(partySize) ||
    partySize < ONLINE_MIN_PARTY_SIZE ||
    partySize > ONLINE_MAX_PARTY_SIZE
  ) {
    throw new ReservationRuleError(
      "INVALID_PARTY_SIZE",
      "Online reservations are available for 1 to 5 guests. For parties of 6 or more, please call (450) 699-8088 to reserve.",
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

export function assertReservationLeadTime(
  reservationAt: Date,
  now = new Date(),
): void {
  if (!isReservationAtLeastLeadTimeAway(reservationAt, now)) {
    throw new ReservationRuleError(
      "BOOKING_LEAD_TIME",
      `Reservations must be made at least ${RESERVATION_LEAD_TIME_HOURS} hours in advance.`,
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

export async function assertStaffBookingRules(
  db: RulesDb,
  settings: RulesSettings,
  query: {
    reservationDate: string;
    reservationTime: string;
    partySize: number;
    reservationAt?: Date;
    now?: Date;
  },
): Promise<void> {
  const reservationAt =
    query.reservationAt ??
    reservationAtFromLocalSlot(query.reservationDate, query.reservationTime);

  assertReservationSlot(settings, query.reservationTime);
  assertStaffPartySize(settings, query.partySize);
  assertDateIsNotPast(query.reservationDate, query.now);
  assertReservationLeadTime(reservationAt, query.now);
  await assertDateIsOpen(db, query.reservationDate);
  await assertCapacityForParty(db, settings, query);
}

export async function assertPublicBookingRules(
  db: RulesDb,
  settings: RulesSettings,
  query: Parameters<typeof assertStaffBookingRules>[2],
): Promise<void> {
  assertPublicPartySize(query.partySize);
  await assertStaffBookingRules(db, settings, query);
}

export async function assertPublicUpdateRules(
  db: RulesDb,
  settings: RulesSettings,
  query: {
    reservationId: string;
    reservationDate: string;
    reservationTime: string;
    currentReservationAt: Date;
    currentPartySize: number;
    nextReservationAt?: Date;
    partySize: number;
    now?: Date;
  },
): Promise<void> {
  assertBeforeGuestModifyCutoff(settings, query.currentReservationAt, query.now);

  const proposedReservationAt =
    query.nextReservationAt ?? query.currentReservationAt;

  // Guest edits must still be allowed on the current reservation, and any
  // rescheduled slot must also remain outside the guest modification cutoff.
  if (proposedReservationAt.getTime() !== query.currentReservationAt.getTime()) {
    assertReservationLeadTime(proposedReservationAt, query.now);
    assertBeforeGuestModifyCutoff(settings, proposedReservationAt, query.now);
  }

  assertReservationSlot(settings, query.reservationTime);
  // Preserve contact edits on existing larger parties, but require a call to
  // change their booking unless the resulting party fits the online policy.
  if (
    query.partySize !== query.currentPartySize ||
    proposedReservationAt.getTime() !== query.currentReservationAt.getTime() ||
    query.partySize <= ONLINE_MAX_PARTY_SIZE
  ) {
    assertPublicPartySize(query.partySize);
  }
  assertDateIsNotPast(query.reservationDate, query.now);
  await assertDateIsOpen(db, query.reservationDate);
  await assertCapacityForParty(db, settings, {
    reservationDate: query.reservationDate,
    reservationTime: query.reservationTime,
    partySize: query.partySize,
    excludeReservationId: query.reservationId,
  });
}
