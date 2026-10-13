ALTER TABLE "DeliveryRun"
ADD COLUMN "routeExplanation" TEXT,
ADD COLUMN "routingStatus" TEXT,
ADD COLUMN "estimatedDurationSeconds" INTEGER,
ADD COLUMN "estimatedDistanceMeters" INTEGER;

ALTER TABLE "DeliveryRun"
ADD CONSTRAINT "DeliveryRun_route_estimates_nonnegative" CHECK (
  ("estimatedDurationSeconds" IS NULL OR "estimatedDurationSeconds" >= 0) AND
  ("estimatedDistanceMeters" IS NULL OR "estimatedDistanceMeters" >= 0)
);

ALTER TABLE "Notification"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

ALTER TABLE "ProviderCatalogMapping"
ADD COLUMN "semanticExpectation" JSONB,
ADD COLUMN "semanticApprovedBy" TEXT,
ADD COLUMN "semanticApprovedAt" TIMESTAMP(3);

CREATE TABLE "ReconciliationImport" (
  "id" TEXT NOT NULL,
  "serviceDate" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "importedBy" TEXT NOT NULL,
  "importedByLabel" TEXT,
  "providerRowCount" INTEGER NOT NULL,
  "providerRows" JSONB NOT NULL,
  "report" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationVariance" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "varianceKey" TEXT NOT NULL,
  "alertKey" TEXT NOT NULL,
  "status" "OperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
  "providerPaymentId" TEXT,
  "orderId" TEXT,
  "orderNumber" TEXT,
  "reasons" JSONB NOT NULL,
  "localSnapshot" JSONB,
  "providerSnapshot" JSONB,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReconciliationVariance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReconciliationVariance_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ReconciliationImport"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReconciliationImport_serviceDate_createdAt_idx" ON "ReconciliationImport"("serviceDate", "createdAt");
CREATE UNIQUE INDEX "ReconciliationVariance_importId_varianceKey_key" ON "ReconciliationVariance"("importId", "varianceKey");
CREATE INDEX "ReconciliationVariance_status_createdAt_idx" ON "ReconciliationVariance"("status", "createdAt");
CREATE INDEX "ReconciliationVariance_providerPaymentId_idx" ON "ReconciliationVariance"("providerPaymentId");
ALTER TYPE "DeliveryStopStatus" ADD VALUE IF NOT EXISTS 'RETURNED_TO_DESK';
ALTER TABLE "DeliveryStop" ADD COLUMN IF NOT EXISTS "returnedToDeskAt" TIMESTAMP(3);
