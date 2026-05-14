const { randomInt } = require("crypto");
const { PrismaClient, ReservationStatus } = require("@prisma/client");

const prisma = new PrismaClient();

const BUSINESS_TIME_ZONE = "America/Montreal";
const CONFIRMATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MANAGE_TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomFromAlphabet(alphabet, length) {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += alphabet[randomInt(alphabet.length)];
  }

  return value;
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];

    if (!part.startsWith("--")) {
      continue;
    }

    const key = part.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseLocalDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Use YYYY-MM-DD.`);
  }

  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function parseSlotTime(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`Invalid time format: ${time}. Use HH:MM in 24-hour time.`);
  }

  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

const zonedFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function getZonedParts(date) {
  const parts = zonedFormatter.formatToParts(date);
  const value = (type) => {
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

function reservationAtFromLocalSlot(date, time) {
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

function dateOnlyToUtcDate(date) {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function timeOnlyToUtcDate(time) {
  const { hour, minute } = parseSlotTime(time);
  return new Date(Date.UTC(1970, 0, 1, hour, minute));
}

function usage() {
  console.log(
    [
      "Usage:",
      "node scripts/create-test-reservation.js --date 2026-05-15 --time 12:30 --phone +15145550123",
      "",
      "Optional:",
      "--name \"Reminder Test\"",
      "--party-size 6",
      "--lang EN|FR",
      "--email you@example.com",
      "--special-requests \"...\"",
    ].join("\n"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true") {
    usage();
    return;
  }

  const date = args.date;
  const time = args.time;
  const phone = args.phone;
  const name = args.name ?? "Reminder Test";
  const partySize = Number(args["party-size"] ?? "6");
  const language = (args.lang ?? "EN").toUpperCase();
  const email = args.email ?? null;
  const specialRequests = args["special-requests"] ?? null;

  if (!date || !time || !phone) {
    usage();
    throw new Error("Missing required arguments: --date, --time, --phone");
  }

  if (!Number.isInteger(partySize) || partySize <= 0) {
    throw new Error(`Invalid --party-size value: ${args["party-size"]}`);
  }

  if (!["EN", "FR"].includes(language)) {
    throw new Error(`Invalid --lang value: ${args.lang}. Use EN or FR.`);
  }

  const reservation = await prisma.reservation.create({
    data: {
      confirmationCode: randomFromAlphabet(CONFIRMATION_CODE_ALPHABET, 8),
      manageToken: randomFromAlphabet(MANAGE_TOKEN_ALPHABET, 6),
      status: ReservationStatus.CONFIRMED,
      reservationDate: dateOnlyToUtcDate(date),
      reservationTime: timeOnlyToUtcDate(time),
      reservationAt: reservationAtFromLocalSlot(date, time),
      partySize,
      guestName: name,
      guestPhone: phone,
      guestEmail: email,
      language,
      specialRequests,
    },
    select: {
      id: true,
      confirmationCode: true,
      manageToken: true,
      reservationAt: true,
      guestPhone: true,
      language: true,
      reminderSentAt: true,
    },
  });

  const localParts = getZonedParts(reservation.reservationAt);

  console.log(JSON.stringify({
    ok: true,
    reservation: {
      ...reservation,
      reservationAtLocal: `${localParts.year}-${pad2(localParts.month)}-${pad2(localParts.day)} ${pad2(localParts.hour)}:${pad2(localParts.minute)} ${BUSINESS_TIME_ZONE}`,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
