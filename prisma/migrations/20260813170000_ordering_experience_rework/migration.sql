-- Buffet Pin Direct ordering-experience rework.
-- This migration intentionally touches only order/delivery tables and the
-- order-settings singleton. Reservation tables, types, indexes, and triggers
-- are outside this migration's scope.

ALTER TYPE "DeliveryStopStatus" ADD VALUE IF NOT EXISTS 'ARRIVED';

CREATE TYPE "DeliveryProofStatus" AS ENUM ('STORED', 'FAILED', 'REPLACED');

ALTER TABLE "Order"
  ADD COLUMN "acceptanceDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "acceptanceDecisionAt" TIMESTAMP(3),
  ADD COLUMN "acceptanceTimedOutAt" TIMESTAMP(3),
  ADD COLUMN "preparationExtendedMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "readyForDeliveryAt" TIMESTAMP(3);

CREATE INDEX "Order_productionStatus_acceptanceDeadlineAt_idx"
  ON "Order"("productionStatus", "acceptanceDeadlineAt");

-- Stable keys make externally retried controller mutations safe without
-- weakening the immutable event record.
ALTER TABLE "OrderEvent" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "OrderEvent_requestKey_key" ON "OrderEvent"("requestKey");

ALTER TABLE "DeliveryRun"
  ADD COLUMN "handedOffAt" TIMESTAMP(3),
  ADD COLUMN "handedOffByActorId" TEXT,
  ADD COLUMN "handedOffByActorLabel" TEXT,
  ADD COLUMN "dispatchedAt" TIMESTAMP(3);

ALTER TABLE "DeliveryStop"
  ADD COLUMN "arrivedAt" TIMESTAMP(3);

CREATE TABLE "DeliveryProof" (
  "id" TEXT NOT NULL,
  "stopId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "status" "DeliveryProofStatus" NOT NULL DEFAULT 'STORED',
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "imageBytes" BYTEA NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "replacedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryProof_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "DeliveryStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeliveryProof_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeliveryProof_size_check" CHECK ("byteSize" > 0 AND "byteSize" <= 5242880),
  CONSTRAINT "DeliveryProof_mime_check" CHECK ("mimeType" IN ('image/jpeg', 'image/png', 'image/webp'))
);

CREATE UNIQUE INDEX "DeliveryProof_stopId_key" ON "DeliveryProof"("stopId");
CREATE INDEX "DeliveryProof_driverId_createdAt_idx" ON "DeliveryProof"("driverId", "createdAt");
CREATE INDEX "DeliveryProof_status_storedAt_idx" ON "DeliveryProof"("status", "storedAt");

ALTER TABLE "RestaurantOrderSettings"
  ADD COLUMN "acceptanceWindowMinutes" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "missedAcceptancePauseThreshold" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "missedAcceptanceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "intakePausedAt" TIMESTAMP(3),
  ADD COLUMN "intakePauseReason" TEXT,
  ADD COLUMN "intakePausedBy" TEXT,
  ADD COLUMN "proofRetentionDays" INTEGER NOT NULL DEFAULT 30,
  ADD CONSTRAINT "RestaurantOrderSettings_acceptance_window_check" CHECK ("acceptanceWindowMinutes" BETWEEN 1 AND 30),
  ADD CONSTRAINT "RestaurantOrderSettings_missed_threshold_check" CHECK ("missedAcceptancePauseThreshold" BETWEEN 1 AND 10),
  ADD CONSTRAINT "RestaurantOrderSettings_missed_count_check" CHECK ("missedAcceptanceCount" >= 0),
  ADD CONSTRAINT "RestaurantOrderSettings_proof_retention_check" CHECK ("proofRetentionDays" BETWEEN 1 AND 365);

-- A paid order receives one authoritative response deadline inside the same
-- database write that confirms payment. Browser clocks never create truth.
CREATE FUNCTION buffet_pin_set_order_acceptance_deadline() RETURNS trigger AS $$
DECLARE
  response_minutes integer;
BEGIN
  IF NEW."paymentStatus" = 'PAID'
     AND (TG_OP = 'INSERT' OR OLD."paymentStatus" IS DISTINCT FROM NEW."paymentStatus")
     AND NEW."acceptanceDeadlineAt" IS NULL THEN
    SELECT COALESCE("acceptanceWindowMinutes", 12)
      INTO response_minutes
      FROM "RestaurantOrderSettings"
      WHERE "id" = 1;
    NEW."acceptanceDeadlineAt" := CURRENT_TIMESTAMP + make_interval(mins => COALESCE(response_minutes, 12));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER buffet_pin_order_acceptance_deadline
BEFORE INSERT OR UPDATE OF "paymentStatus" ON "Order"
FOR EACH ROW EXECUTE FUNCTION buffet_pin_set_order_acceptance_deadline();

CREATE FUNCTION buffet_pin_enqueue_order_acceptance_deadline() RETURNS trigger AS $$
BEGIN
  IF NEW."paymentStatus" = 'PAID'
     AND NEW."productionStatus" = 'AWAITING_ACCEPTANCE'
     AND NEW."acceptanceDeadlineAt" IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD."acceptanceDeadlineAt" IS DISTINCT FROM NEW."acceptanceDeadlineAt") THEN
    INSERT INTO "AsyncJob" (
      "id", "kind", "lane", "aggregateType", "aggregateId", "payload",
      "dedupeKey", "runAt", "state", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, 'EXPIRE_ORDER_ACCEPTANCE', 'CRITICAL', 'Order',
      NEW."id", jsonb_build_object('deadline', NEW."acceptanceDeadlineAt"),
      'order-acceptance:' || NEW."id", NEW."acceptanceDeadlineAt", 'PENDING',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT ("dedupeKey") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER buffet_pin_order_acceptance_deadline_outbox
AFTER INSERT OR UPDATE OF "paymentStatus", "acceptanceDeadlineAt" ON "Order"
FOR EACH ROW EXECUTE FUNCTION buffet_pin_enqueue_order_acceptance_deadline();

-- Existing order rows are known fake/test data. Give any still-open paid test
-- order a fresh response window so the new controller can exercise it.
UPDATE "Order"
SET "acceptanceDeadlineAt" = CURRENT_TIMESTAMP + INTERVAL '12 minutes'
WHERE "paymentStatus" = 'PAID'
  AND "productionStatus" = 'AWAITING_ACCEPTANCE'
  AND "acceptanceDeadlineAt" IS NULL;
