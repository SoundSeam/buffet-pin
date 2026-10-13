ALTER TABLE "Driver" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "DriverShift" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DriverShift_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DriverShift_window_check" CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "DriverShift_driverId_isActive_startsAt_endsAt_idx" ON "DriverShift"("driverId", "isActive", "startsAt", "endsAt");
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
