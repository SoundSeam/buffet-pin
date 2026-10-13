ALTER TABLE "DeliveryZone"
  ADD COLUMN "configurationKey" TEXT,
  ADD COLUMN "boundaryGeoJson" JSONB,
  ADD COLUMN "displayColor" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "targetDriveMinutes" INTEGER;

CREATE UNIQUE INDEX "DeliveryZone_configurationKey_key"
  ON "DeliveryZone"("configurationKey");

ALTER TABLE "DeliveryZone"
  ADD CONSTRAINT "DeliveryZone_targetDriveMinutes_check"
  CHECK ("targetDriveMinutes" IS NULL OR "targetDriveMinutes" > 0);
