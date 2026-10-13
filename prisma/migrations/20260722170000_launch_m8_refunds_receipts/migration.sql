CREATE TYPE "RefundIntentStatus" AS ENUM ('PENDING', 'SUBMITTING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'REQUIRES_REVIEW');
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'SUBMITTING' AFTER 'PENDING';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN' AFTER 'FAILED';

ALTER TABLE "Notification" ADD COLUMN "idempotencyKey" TEXT;
UPDATE "Notification" SET "idempotencyKey" = 'legacy-notification:' || "id" WHERE "idempotencyKey" IS NULL;
ALTER TABLE "Notification" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");

ALTER TABLE "RestaurantOrderSettings"
ADD COLUMN "partialRefundsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "receiptLegalName" TEXT,
ADD COLUMN "receiptAddress" TEXT,
ADD COLUMN "receiptPhone" TEXT,
ADD COLUMN "receiptTaxRegistration" TEXT;

CREATE TABLE "RefundIntent" (
  "id" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "status" "RefundIntentStatus" NOT NULL DEFAULT 'PENDING',
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "reason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorLabel" TEXT,
  "providerRefundId" TEXT,
  "providerIdempotencyKey" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "requestPayload" JSONB,
  "providerResponse" JSONB,
  "submittedAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundIntent_amount_check" CHECK ("amountCents" > 0)
);
CREATE UNIQUE INDEX "RefundIntent_requestKey_key" ON "RefundIntent"("requestKey");
CREATE UNIQUE INDEX "RefundIntent_providerRefundId_key" ON "RefundIntent"("providerRefundId");
CREATE UNIQUE INDEX "RefundIntent_providerIdempotencyKey_key" ON "RefundIntent"("providerIdempotencyKey");
CREATE INDEX "RefundIntent_orderId_status_idx" ON "RefundIntent"("orderId", "status");
CREATE INDEX "RefundIntent_paymentId_status_idx" ON "RefundIntent"("paymentId", "status");
CREATE INDEX "RefundIntent_status_updatedAt_idx" ON "RefundIntent"("status", "updatedAt");
ALTER TABLE "RefundIntent" ADD CONSTRAINT "RefundIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundIntent" ADD CONSTRAINT "RefundIntent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
