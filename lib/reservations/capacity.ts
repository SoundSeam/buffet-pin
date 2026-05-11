import {
  ReservationStatus,
  type PrismaClient,
  type Settings,
  type SlotCapacitySetting,
} from "@prisma/client";

import {
  dateOnlyToUtcDate,
  formatSlotTime,
  timeOnlyToUtcDate,
} from "./time";

type CapacitySettings = Pick<Settings, "slotCapacityGuests"> & {
  slotCapacities?: Pick<SlotCapacitySetting, "reservationTime" | "capacityGuests">[];
};

type CapacityDb = Pick<PrismaClient, "reservation">;

type CapacityQuery = {
  reservationDate: string;
  reservationTime: string;
  excludeReservationId?: string;
};

export type SlotCapacity = {
  reservationTime: string;
  configuredCapacity: number;
  reservedGuests: number;
  remainingCapacity: number;
};

function buildConfiguredCapacityMap(settings: CapacitySettings) {
  return Object.fromEntries(
    settings.slotCapacities?.map((slotCapacity) => [
      formatSlotTime(slotCapacity.reservationTime),
      slotCapacity.capacityGuests,
    ]) ?? [],
  ) as Record<string, number>;
}

export function getConfiguredCapacityForSlot(
  settings: CapacitySettings,
  reservationTime: string,
): number {
  const configuredCapacities = buildConfiguredCapacityMap(settings);
  return configuredCapacities[reservationTime] ?? settings.slotCapacityGuests;
}

function activeReservationWhere(excludeReservationId?: string) {
  return {
    status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
  };
}

export async function getReservedGuestsForSlot(
  db: CapacityDb,
  query: CapacityQuery,
): Promise<number> {
  const result = await db.reservation.aggregate({
    where: {
      ...activeReservationWhere(query.excludeReservationId),
      reservationDate: dateOnlyToUtcDate(query.reservationDate),
      reservationTime: timeOnlyToUtcDate(query.reservationTime),
    },
    _sum: {
      partySize: true,
    },
  });

  return result._sum.partySize ?? 0;
}

export async function getReservedGuestsBySlot(
  db: CapacityDb,
  query: {
    reservationDate: string;
    reservationTimes?: string[];
    excludeReservationId?: string;
  },
): Promise<Record<string, number>> {
  const rows = await db.reservation.groupBy({
    by: ["reservationTime"],
    where: {
      ...activeReservationWhere(query.excludeReservationId),
      reservationDate: dateOnlyToUtcDate(query.reservationDate),
      ...(query.reservationTimes
        ? {
            reservationTime: {
              in: query.reservationTimes.map(timeOnlyToUtcDate),
            },
          }
        : {}),
    },
    _sum: {
      partySize: true,
    },
  });

  const reservedBySlot = Object.fromEntries(
    query.reservationTimes?.map((time) => [time, 0]) ?? [],
  ) as Record<string, number>;

  for (const row of rows) {
    reservedBySlot[formatSlotTime(row.reservationTime)] = row._sum.partySize ?? 0;
  }

  return reservedBySlot;
}

export async function getRemainingCapacityForSlot(
  db: CapacityDb,
  settings: CapacitySettings,
  query: CapacityQuery,
): Promise<number> {
  const reservedGuests = await getReservedGuestsForSlot(db, query);
  const configuredCapacity = getConfiguredCapacityForSlot(
    settings,
    query.reservationTime,
  );

  return Math.max(configuredCapacity - reservedGuests, 0);
}

export async function getCapacityBySlot(
  db: CapacityDb,
  settings: CapacitySettings,
  query: {
    reservationDate: string;
    reservationTimes: string[];
    excludeReservationId?: string;
  },
): Promise<SlotCapacity[]> {
  const reservedBySlot = await getReservedGuestsBySlot(db, query);
  const configuredCapacities = buildConfiguredCapacityMap(settings);

  return query.reservationTimes.map((reservationTime) => {
    const reservedGuests = reservedBySlot[reservationTime] ?? 0;
    const configuredCapacity =
      configuredCapacities[reservationTime] ?? settings.slotCapacityGuests;

    return {
      reservationTime,
      configuredCapacity,
      reservedGuests,
      remainingCapacity: Math.max(configuredCapacity - reservedGuests, 0),
    };
  });
}

export async function hasCapacityForParty(
  db: CapacityDb,
  settings: CapacitySettings,
  query: CapacityQuery & { partySize: number },
): Promise<boolean> {
  const remainingCapacity = await getRemainingCapacityForSlot(db, settings, query);
  return query.partySize <= remainingCapacity;
}
