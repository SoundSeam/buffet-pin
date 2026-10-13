CREATE TYPE "CatalogOwnership" AS ENUM ('APP_OWNED', 'CLOVER_OWNED');
CREATE TYPE "CatalogEntityType" AS ENUM ('CATEGORY', 'ITEM', 'MODIFIER_GROUP', 'MODIFIER_OPTION', 'TAX_RATE', 'ORDER_TYPE', 'SERVICE_CHARGE');
CREATE TYPE "CatalogMappingStatus" AS ENUM ('VERIFIED', 'STALE', 'MISSING', 'DISABLED', 'AMBIGUOUS');

ALTER TABLE "MenuCategory" ADD COLUMN "isDeliveryChannel" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MenuItem" ADD COLUMN "isDeliveryChannel" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "CatalogConfiguration" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "ownership" "CatalogOwnership" NOT NULL DEFAULT 'APP_OWNED',
  "provider" TEXT NOT NULL DEFAULT 'clover',
  "requiredTaxMappingKey" TEXT NOT NULL DEFAULT 'quebec-combined',
  "requiredOrderTypeKey" TEXT NOT NULL DEFAULT 'delivery',
  "requiredDeliveryFeeMappingKey" TEXT NOT NULL DEFAULT 'delivery-fee',
  "maxMappingAgeMinutes" INTEGER NOT NULL DEFAULT 1440,
  "lastSyncStartedAt" TIMESTAMP(3),
  "lastSyncCompletedAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogConfiguration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CatalogConfiguration_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "CatalogConfiguration_mapping_age_check" CHECK ("maxMappingAgeMinutes" BETWEEN 1 AND 10080)
);

CREATE TABLE "ProviderCatalogMapping" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'clover',
  "entityType" "CatalogEntityType" NOT NULL,
  "localKey" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "status" "CatalogMappingStatus" NOT NULL DEFAULT 'MISSING',
  "localFingerprint" TEXT NOT NULL,
  "providerFingerprint" TEXT,
  "providerUpdatedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "issueCode" TEXT,
  "issueMessage" TEXT,
  "providerSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderCatalogMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderCatalogMapping_provider_entityType_localKey_key" ON "ProviderCatalogMapping"("provider", "entityType", "localKey");
CREATE UNIQUE INDEX "ProviderCatalogMapping_provider_entityType_providerId_key" ON "ProviderCatalogMapping"("provider", "entityType", "providerId");
CREATE INDEX "ProviderCatalogMapping_provider_status_entityType_idx" ON "ProviderCatalogMapping"("provider", "status", "entityType");
