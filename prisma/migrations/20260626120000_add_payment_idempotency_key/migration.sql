-- Store Clover Ecommerce idempotency keys locally before external charge calls
-- so retries can recover the original local order/payment instead of creating
-- another local order for the same provider charge.
ALTER TABLE "Payment" ADD COLUMN "providerIdempotencyKey" TEXT;

CREATE UNIQUE INDEX "Payment_providerIdempotencyKey_key" ON "Payment"("providerIdempotencyKey");
