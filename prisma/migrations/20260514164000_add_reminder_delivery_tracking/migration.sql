ALTER TABLE "Reservation"
ADD COLUMN "reminderLastAttemptAt" TIMESTAMP(3),
ADD COLUMN "reminderMessageSid" TEXT,
ADD COLUMN "reminderStatus" TEXT;

CREATE UNIQUE INDEX "Reservation_reminderMessageSid_key" ON "Reservation"("reminderMessageSid");
