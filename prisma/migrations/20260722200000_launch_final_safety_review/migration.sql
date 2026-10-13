-- Bind payment idempotency keys to immutable checkout input and lease webhook
-- processing so concurrent provider deliveries cannot both apply effects.
ALTER TABLE "Payment"
  ADD COLUMN "checkoutRequestFingerprint" TEXT;

ALTER TABLE "PaymentWebhookEvent"
  ADD COLUMN "processingStartedAt" TIMESTAMP(3);

CREATE INDEX "PaymentWebhookEvent_processingStartedAt_idx"
  ON "PaymentWebhookEvent"("processingStartedAt");
