import { randomBytes } from "node:crypto";
import { type Prisma, type PrismaClient } from "@prisma/client";

const ORDER_TIME_ZONE = "America/Toronto";

function serviceDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ORDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function generateTrackingToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function allocateOperationalOrderNumber(
  client: PrismaClient | Prisma.TransactionClient,
  now = new Date(),
): Promise<string> {
  const { year, month, day } = serviceDateParts(now);
  const serviceDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const sequence = await client.orderNumberSequence.upsert({
    where: { serviceDate },
    create: { serviceDate, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  const allocated = sequence.nextValue - 1;
  if (allocated > 9_999) {
    throw new Error("Daily operational order-number capacity exhausted.");
  }
  return `BP-${year.slice(-2)}${month}${day}-${allocated.toString().padStart(4, "0")}`;
}

export async function createOrderIdentity(
  client: PrismaClient | Prisma.TransactionClient,
  now = new Date(),
) {
  return {
    trackingToken: generateTrackingToken(),
    orderNumber: await allocateOperationalOrderNumber(client, now),
  };
}
