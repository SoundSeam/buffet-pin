-- Additive only: preserve every existing reservation and settings value.
ALTER TABLE "Settings" ADD COLUMN "onlineReservationsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReservationAvailabilityEvent" (
    "id" TEXT NOT NULL,
    "previousEnabled" BOOLEAN NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationAvailabilityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReservationAvailabilityEvent_createdAt_idx" ON "ReservationAvailabilityEvent"("createdAt");
