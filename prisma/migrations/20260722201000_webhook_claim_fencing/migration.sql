-- Fence recoverable webhook leases so an expired worker cannot clear or
-- finalize a newer claim.
ALTER TABLE "PaymentWebhookEvent"
  ADD COLUMN "processingToken" TEXT;

CREATE INDEX "PaymentWebhookEvent_processingToken_idx"
  ON "PaymentWebhookEvent"("processingToken");
