CREATE TYPE "OperationalAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "OperationalAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "OperationalAlert" (
  "id" TEXT NOT NULL,
  "alertKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" "OperationalAlertSeverity" NOT NULL,
  "status" "OperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
  "entityType" TEXT,
  "entityId" TEXT,
  "orderNumber" TEXT,
  "summary" TEXT NOT NULL,
  "details" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalAlert_alertKey_key" ON "OperationalAlert"("alertKey");
CREATE INDEX "OperationalAlert_status_severity_lastSeenAt_idx" ON "OperationalAlert"("status", "severity", "lastSeenAt");
CREATE INDEX "OperationalAlert_category_status_idx" ON "OperationalAlert"("category", "status");
CREATE INDEX "OperationalAlert_entityType_entityId_idx" ON "OperationalAlert"("entityType", "entityId");

ALTER TABLE "RestaurantOrderSettings" ALTER COLUMN "pickupEnabled" SET DEFAULT false;
UPDATE "RestaurantOrderSettings" SET "pickupEnabled" = false, "scheduledOrdersEnabled" = false, "asapOnly" = true;

CREATE TABLE "OperationalAuditEvent" (
  "id" TEXT NOT NULL,
  "actorType" "OrderActorType" NOT NULL,
  "actorId" TEXT,
  "actorLabel" TEXT,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationalAuditEvent_entityType_entityId_createdAt_idx" ON "OperationalAuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "OperationalAuditEvent_eventType_createdAt_idx" ON "OperationalAuditEvent"("eventType", "createdAt");
CREATE TRIGGER "OperationalAuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "OperationalAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_immutable_audit_change"();
