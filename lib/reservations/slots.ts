import type { Settings } from "@prisma/client";

export type SlotSettings = Pick<
  Settings,
  "firstSlot" | "lastSlot" | "slotIntervalMinutes"
>;

export type NormalizedSlotSettings = {
  firstSlot: string;
  lastSlot: string;
  slotIntervalMinutes: number;
};

// Reservations run in two service windows, so slot validation uses an explicit
// app-wide list instead of deriving a continuous range from first/last slot.
export const RESERVATION_SLOT_TIMES = [
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
] as const;

export const DEFAULT_SLOT_SETTINGS: NormalizedSlotSettings = {
  firstSlot: "11:30",
  lastSlot: "20:00",
  slotIntervalMinutes: 30,
};

export function normalizeSlotSettings(
  _settings: SlotSettings,
): NormalizedSlotSettings {
  return DEFAULT_SLOT_SETTINGS;
}

export function generateReservationSlots(
  _settings: NormalizedSlotSettings,
): string[] {
  return [...RESERVATION_SLOT_TIMES];
}

export function generateReservationSlotsFromSettings(
  _settings: SlotSettings,
): string[] {
  return [...RESERVATION_SLOT_TIMES];
}

export function isReservationSlot(
  time: string,
  _settings: NormalizedSlotSettings,
): boolean {
  return RESERVATION_SLOT_TIMES.includes(
    time as (typeof RESERVATION_SLOT_TIMES)[number],
  );
}

export function isReservationSlotForSettings(
  time: string,
  _settings: SlotSettings,
): boolean {
  return RESERVATION_SLOT_TIMES.includes(
    time as (typeof RESERVATION_SLOT_TIMES)[number],
  );
}
