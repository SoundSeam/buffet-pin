export const BUSINESS_TIME_ZONE = "America/Montreal";
export const RESERVATION_LEAD_TIME_HOURS = 2;

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type TimeParts = {
  hour: number;
  minute: number;
};

type ZonedParts = DateParts & TimeParts;

const zonedFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

export function parseLocalDate(date: string): DateParts {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(`Invalid date format: ${date}`);
  }

  const [year, month, day] = date.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  return { year, month, day };
}

export function parseSlotTime(time: string): TimeParts {
  if (!TIME_PATTERN.test(time)) {
    throw new Error(`Invalid time format: ${time}`);
  }

  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

export function minutesFromSlotTime(time: string): number {
  const { hour, minute } = parseSlotTime(time);
  return hour * 60 + minute;
}

export function slotTimeFromMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid minutes for slot time: ${minutes}`);
  }

  return `${pad2(hour)}:${pad2(minute)}`;
}

export function dateOnlyToUtcDate(date: string): Date {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

export function timeOnlyToUtcDate(time: string): Date {
  const { hour, minute } = parseSlotTime(time);
  return new Date(Date.UTC(1970, 0, 1, hour, minute));
}

export function formatDateOnly(date: Date): string {
  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
  ].join("-");
}

export function formatSlotTime(date: Date): string {
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function getZonedParts(date: Date): ZonedParts {
  const parts = zonedFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((item) => item.type === type);

    if (!part) {
      throw new Error(`Missing ${type} while formatting zoned date`);
    }

    return Number(part.value);
  };

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

export function todayInBusinessTimeZone(now = new Date()): string {
  const { year, month, day } = getZonedParts(now);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function isLocalDateInPast(date: string, now = new Date()): boolean {
  return date < todayInBusinessTimeZone(now);
}

export function reservationAtFromLocalSlot(date: string, time: string): Date {
  const desiredDate = parseLocalDate(date);
  const desiredTime = parseSlotTime(time);
  const desiredAsUtc = Date.UTC(
    desiredDate.year,
    desiredDate.month - 1,
    desiredDate.day,
    desiredTime.hour,
    desiredTime.minute,
  );

  let timestamp = desiredAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedParts(new Date(timestamp));
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );

    timestamp -= actualAsUtc - desiredAsUtc;
  }

  return new Date(timestamp);
}

export function bookingLeadTimeCutoff(
  now = new Date(),
  leadTimeHours = RESERVATION_LEAD_TIME_HOURS,
): Date {
  return new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000);
}

export function isReservationAtLeastLeadTimeAway(
  reservationAt: Date,
  now = new Date(),
  leadTimeHours = RESERVATION_LEAD_TIME_HOURS,
): boolean {
  return reservationAt.getTime() >= bookingLeadTimeCutoff(now, leadTimeHours).getTime();
}

export function isLocalSlotAtLeastLeadTimeAway(
  date: string,
  time: string,
  now = new Date(),
  leadTimeHours = RESERVATION_LEAD_TIME_HOURS,
): boolean {
  return isReservationAtLeastLeadTimeAway(
    reservationAtFromLocalSlot(date, time),
    now,
    leadTimeHours,
  );
}

export function guestModifyCutoffAt(
  reservationAt: Date,
  cutoffHours: number,
): Date {
  return new Date(reservationAt.getTime() - cutoffHours * 60 * 60 * 1000);
}

export function isBeforeGuestModifyCutoff(
  reservationAt: Date,
  cutoffHours: number,
  now = new Date(),
): boolean {
  return now.getTime() <= guestModifyCutoffAt(reservationAt, cutoffHours).getTime();
}
