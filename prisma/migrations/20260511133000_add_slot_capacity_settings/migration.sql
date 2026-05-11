CREATE TABLE "SlotCapacitySetting" (
    "id" TEXT NOT NULL,
    "settingsId" INTEGER NOT NULL DEFAULT 1,
    "reservationTime" TIME(0) NOT NULL,
    "capacityGuests" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotCapacitySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlotCapacitySetting_settingsId_reservationTime_key"
ON "SlotCapacitySetting"("settingsId", "reservationTime");

CREATE INDEX "SlotCapacitySetting_settingsId_idx"
ON "SlotCapacitySetting"("settingsId");

ALTER TABLE "SlotCapacitySetting"
ADD CONSTRAINT "SlotCapacitySetting_settingsId_fkey"
FOREIGN KEY ("settingsId") REFERENCES "Settings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
