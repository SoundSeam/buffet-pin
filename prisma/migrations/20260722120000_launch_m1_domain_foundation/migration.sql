-- CreateEnum
CREATE TYPE "PrintJobPurpose" AS ENUM ('INITIAL', 'REPRINT', 'FALLBACK');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'SUBMITTING', 'SUBMITTED', 'PRINTING', 'PRINTED', 'FAILED', 'UNKNOWN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderProductionStatus" AS ENUM ('AWAITING_ACCEPTANCE', 'ACCEPTED', 'PREPARING', 'PACKING', 'PACKED', 'AT_DISPATCH_DESK', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderDispatchStatus" AS ENUM ('UNASSIGNED', 'RUN_PLANNED', 'READY_FOR_PICKUP', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED', 'EXCEPTION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('MANAGER', 'OPERATOR', 'DISPATCHER', 'REPORTING');

-- CreateEnum
CREATE TYPE "DeliveryRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'ASSIGNED', 'READY', 'PICKED_UP', 'EN_ROUTE', 'COMPLETED', 'CANCELLED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "DeliveryStopStatus" AS ENUM ('PLANNED', 'BAG_VERIFIED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "atDispatchDeskAt" TIMESTAMP(3),
ADD COLUMN     "deliveryZoneIdSnapshot" TEXT,
ADD COLUMN     "deliveryZoneNameSnapshot" TEXT,
ADD COLUMN     "dispatchDeadlineAt" TIMESTAMP(3),
ADD COLUMN     "dispatchStatus" "OrderDispatchStatus" NOT NULL DEFAULT 'UNASSIGNED',
ADD COLUMN     "legacyPublicTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "orderNumber" TEXT NOT NULL DEFAULT ('BP-'::text || upper(substr(md5((gen_random_uuid())::text), 1, 10))),
ADD COLUMN     "packedAt" TIMESTAMP(3),
ADD COLUMN     "packingStartedAt" TIMESTAMP(3),
ADD COLUMN     "preparationStartedAt" TIMESTAMP(3),
ADD COLUMN     "productionStatus" "OrderProductionStatus" NOT NULL DEFAULT 'AWAITING_ACCEPTANCE',
ADD COLUMN     "promisedDeliveryEndAt" TIMESTAMP(3),
ADD COLUMN     "promisedDeliveryStartAt" TIMESTAMP(3),
ADD COLUMN     "trackingToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- Preserve legacy tracking links only for rows that exist at migration time.
-- New application and database writes default closed.
ALTER TABLE "Order" ALTER COLUMN "legacyPublicTrackingEnabled" SET DEFAULT false;

-- Conservatively project legacy fulfillment into the new independent dimensions.
-- Timestamps remain null when the old model did not prove the physical handoff time.
UPDATE "Order" SET
  "productionStatus" = CASE
    WHEN "fulfillmentStatus" = 'ACCEPTED' THEN 'ACCEPTED'::"OrderProductionStatus"
    WHEN "fulfillmentStatus" = 'PREPARING' THEN 'PREPARING'::"OrderProductionStatus"
    WHEN "fulfillmentStatus" = 'READY_FOR_PICKUP' THEN 'PACKED'::"OrderProductionStatus"
    WHEN "fulfillmentStatus" IN ('DRIVER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVING_SOON', 'DELIVERED') THEN 'AT_DISPATCH_DESK'::"OrderProductionStatus"
    WHEN "fulfillmentStatus" = 'REJECTED' THEN 'REJECTED'::"OrderProductionStatus"
    WHEN "fulfillmentStatus" = 'CANCELLED' THEN 'CANCELLED'::"OrderProductionStatus"
    ELSE 'AWAITING_ACCEPTANCE'::"OrderProductionStatus"
  END,
  "dispatchStatus" = CASE
    WHEN "fulfillmentStatus" = 'READY_FOR_PICKUP' THEN 'READY_FOR_PICKUP'::"OrderDispatchStatus"
    WHEN "fulfillmentStatus" = 'DRIVER_ASSIGNED' THEN 'RUN_PLANNED'::"OrderDispatchStatus"
    WHEN "fulfillmentStatus" = 'PICKED_UP' THEN 'PICKED_UP'::"OrderDispatchStatus"
    WHEN "fulfillmentStatus" IN ('ON_THE_WAY', 'ARRIVING_SOON') THEN 'EN_ROUTE'::"OrderDispatchStatus"
    WHEN "fulfillmentStatus" = 'DELIVERED' THEN 'DELIVERED'::"OrderDispatchStatus"
    WHEN "fulfillmentStatus" IN ('REJECTED', 'CANCELLED') THEN 'CANCELLED'::"OrderDispatchStatus"
    ELSE 'UNASSIGNED'::"OrderDispatchStatus"
  END;

-- Compatibility defaults keep old application writers working during the
-- expand phase. The public code remains readable, but is never reused as the
-- new private tracking token or operational number.
ALTER TABLE "Order"
ADD CONSTRAINT "Order_trackingToken_separate_check" CHECK ("trackingToken" <> "publicCode"),
ADD CONSTRAINT "Order_orderNumber_format_check" CHECK ("orderNumber" ~ '^BP-[A-Z0-9-]+$');

-- AlterTable
ALTER TABLE "OrderEvent" ADD COLUMN     "fromDispatchStatus" "OrderDispatchStatus",
ADD COLUMN     "fromProductionStatus" "OrderProductionStatus",
ADD COLUMN     "toDispatchStatus" "OrderDispatchStatus",
ADD COLUMN     "toProductionStatus" "OrderProductionStatus";

-- CreateTable
CREATE TABLE "OrderNumberSequence" (
    "serviceDate" DATE NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderNumberSequence_pkey" PRIMARY KEY ("serviceDate")
);

-- CreateTable
CREATE TABLE "ExternalOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerOrderId" TEXT,
    "state" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "sanitizedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "initialForOrderId" TEXT,
    "purpose" "PrintJobPurpose" NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "providerPrintEventId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "requestedByActorType" "OrderActorType" NOT NULL,
    "requestedByActorId" TEXT,
    "requestedByLabel" TEXT,
    "sanitizedRequest" JSONB,
    "sanitizedObservation" JSONB,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PrintJob"
ADD CONSTRAINT "PrintJob_initial_purpose_check" CHECK (
  ("purpose" = 'INITIAL' AND "initialForOrderId" = "orderId") OR
  ("purpose" <> 'INITIAL' AND "initialForOrderId" IS NULL)
),
ADD CONSTRAINT "PrintJob_reprint_reason_check" CHECK (
  "purpose" = 'INITIAL' OR length(trim(coalesce("reason", ''))) > 0
);

-- CreateTable
CREATE TABLE "DriverZoneEligibility" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "deliveryZoneId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverZoneEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "authUserId" TEXT,
    "role" "StaffRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAccessEvent" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" "OrderActorType" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "fromRole" "StaffRole",
    "toRole" "StaffRole",
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "status" "DeliveryRunStatus" NOT NULL DEFAULT 'DRAFT',
    "zoneIdSnapshot" TEXT NOT NULL,
    "zoneNameSnapshot" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "driverId" TEXT,
    "approvedByActorId" TEXT,
    "approvedByActorLabel" TEXT,
    "crossZoneOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "plannedDepartureAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeliveryRun"
ADD CONSTRAINT "DeliveryRun_capacity_check" CHECK ("capacity" BETWEEN 1 AND 4),
ADD CONSTRAINT "DeliveryRun_cross_zone_reason_check" CHECK (
  NOT "crossZoneOverride" OR length(trim(coalesce("overrideReason", ''))) > 0
);

-- CreateTable
CREATE TABLE "DeliveryStop" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "DeliveryStopStatus" NOT NULL DEFAULT 'PLANNED',
    "etaAt" TIMESTAMP(3),
    "bagVerifiedAt" TIMESTAMP(3),
    "bagVerifiedBy" TEXT,
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "exceptionCode" TEXT,
    "exceptionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryStop_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeliveryStop"
ADD CONSTRAINT "DeliveryStop_position_check" CHECK ("position" BETWEEN 1 AND 4);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalOrder_requestKey_key" ON "ExternalOrder"("requestKey");

-- CreateIndex
CREATE INDEX "ExternalOrder_state_updatedAt_idx" ON "ExternalOrder"("state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalOrder_provider_providerOrderId_key" ON "ExternalOrder"("provider", "providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalOrder_orderId_provider_key" ON "ExternalOrder"("orderId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_initialForOrderId_key" ON "PrintJob"("initialForOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_idempotencyKey_key" ON "PrintJob"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_providerPrintEventId_key" ON "PrintJob"("providerPrintEventId");

-- CreateIndex
CREATE INDEX "PrintJob_status_createdAt_idx" ON "PrintJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PrintJob_orderId_createdAt_idx" ON "PrintJob"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "DriverZoneEligibility_deliveryZoneId_isActive_idx" ON "DriverZoneEligibility"("deliveryZoneId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DriverZoneEligibility_driverId_deliveryZoneId_key" ON "DriverZoneEligibility"("driverId", "deliveryZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_email_key" ON "StaffMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_authUserId_key" ON "StaffMember"("authUserId");

-- CreateIndex
CREATE INDEX "StaffMember_role_isActive_idx" ON "StaffMember"("role", "isActive");

-- CreateIndex
CREATE INDEX "StaffAccessEvent_staffMemberId_createdAt_idx" ON "StaffAccessEvent"("staffMemberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRun_runNumber_key" ON "DeliveryRun"("runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRun_requestKey_key" ON "DeliveryRun"("requestKey");

-- CreateIndex
CREATE INDEX "DeliveryRun_status_createdAt_idx" ON "DeliveryRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryRun_driverId_status_idx" ON "DeliveryRun"("driverId", "status");

-- CreateIndex
CREATE INDEX "DeliveryStop_orderId_status_idx" ON "DeliveryStop"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryStop_runId_position_key" ON "DeliveryStop"("runId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryStop_runId_orderId_key" ON "DeliveryStop"("runId", "orderId");

-- An order may have historical completed/cancelled stops, but only one active
-- delivery assignment across all runs.
CREATE UNIQUE INDEX "DeliveryStop_one_active_order_key"
ON "DeliveryStop"("orderId")
WHERE "status" IN ('PLANNED', 'BAG_VERIFIED', 'PICKED_UP', 'EN_ROUTE');

-- CreateIndex
CREATE UNIQUE INDEX "Order_trackingToken_key" ON "Order"("trackingToken");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_trackingToken_idx" ON "Order"("trackingToken");

-- CreateIndex
CREATE INDEX "Order_productionStatus_dispatchStatus_createdAt_idx" ON "Order"("productionStatus", "dispatchStatus", "createdAt");

-- Operational identity is immutable after insertion. Predictable order numbers
-- are display-only; tracking credentials must never be rotated into identifiers.
CREATE FUNCTION "prevent_order_identity_change"() RETURNS trigger AS $$
BEGIN
  IF NEW."orderNumber" IS DISTINCT FROM OLD."orderNumber"
     OR NEW."trackingToken" IS DISTINCT FROM OLD."trackingToken"
     OR NEW."publicCode" IS DISTINCT FROM OLD."publicCode" THEN
    RAISE EXCEPTION 'order identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_identity_immutable"
BEFORE UPDATE ON "Order"
FOR EACH ROW EXECUTE FUNCTION "prevent_order_identity_change"();

CREATE FUNCTION "prevent_immutable_audit_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OrderEvent_immutable"
BEFORE UPDATE OR DELETE ON "OrderEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_immutable_audit_change"();

CREATE TRIGGER "StaffAccessEvent_immutable"
BEFORE UPDATE OR DELETE ON "StaffAccessEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_immutable_audit_change"();

-- AddForeignKey
ALTER TABLE "ExternalOrder" ADD CONSTRAINT "ExternalOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverZoneEligibility" ADD CONSTRAINT "DriverZoneEligibility_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverZoneEligibility" ADD CONSTRAINT "DriverZoneEligibility_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAccessEvent" ADD CONSTRAINT "StaffAccessEvent_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryStop" ADD CONSTRAINT "DeliveryStop_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeliveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryStop" ADD CONSTRAINT "DeliveryStop_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
