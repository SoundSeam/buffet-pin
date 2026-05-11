import type { Settings } from "@prisma/client";

import {
  formatSlotTime,
  minutesFromSlotTime,
  slotTimeFromMinutes,
} from "./time";

export type SlotSettings = Pick<
  Settings,
  "firstSlot" | "lastSlot" | "slotIntervalMinutes"
>;

export type NormalizedSlotSettings = {
  firstSlot: string;
  lastSlot: string;
  slotIntervalMinutes: number;
};

export const DEFAULT_SLOT_SETTINGS: NormalizedSlotSettings = {
  firstSlot: "16:30",
  lastSlot: "20:00",
  slotIntervalMinutes: 30,
};

export function normalizeSlotSettings(
  settings: SlotSettings,
): NormalizedSlotSettings {
  return {
    firstSlot: formatSlotTime(settings.firstSlot),
    lastSlot: formatSlotTime(settings.lastSlot),
    slotIntervalMinutes: settings.slotIntervalMinutes,
  };
}

export function generateReservationSlots(
  settings: NormalizedSlotSettings,
): string[] {
  const first = minutesFromSlotTime(settings.firstSlot);
  const last = minutesFromSlotTime(settings.lastSlot);

  if (settings.slotIntervalMinutes <= 0) {
    throw new Error("Slot interval must be greater than zero");
  }

  if (first > last) {
    throw new Error("First slot must be before or equal to last slot");
  }

  const slots: string[] = [];

  for (
    let minutes = first;
    minutes <= last;
    minutes += settings.slotIntervalMinutes
  ) {
    slots.push(slotTimeFromMinutes(minutes));
  }

  return slots;
}

export function generateReservationSlotsFromSettings(
  settings: SlotSettings,
): string[] {
  return generateReservationSlots(normalizeSlotSettings(settings));
}

export function isReservationSlot(
  time: string,
  settings: NormalizedSlotSettings,
): boolean {
  return generateReservationSlots(settings).includes(time);
}

export function isReservationSlotForSettings(
  time: string,
  settings: SlotSettings,
): boolean {
  return isReservationSlot(time, normalizeSlotSettings(settings));
}
