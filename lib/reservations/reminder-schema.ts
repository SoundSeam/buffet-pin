import type { PrismaClient } from "@prisma/client";

type ReminderSchemaDb = Pick<PrismaClient, "$executeRawUnsafe">;

export async function ensureReminderDeliveryTrackingSchema(
  db: ReminderSchemaDb,
): Promise<void> {
  await db.$executeRawUnsafe(`
    ALTER TABLE "Reservation"
    ADD COLUMN IF NOT EXISTS "reminderLastAttemptAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "reminderMessageSid" TEXT,
    ADD COLUMN IF NOT EXISTS "reminderStatus" TEXT
  `);

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_reminderMessageSid_key"
    ON "Reservation"("reminderMessageSid")
  `);
}
