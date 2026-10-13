-- Fence Clover Atomic Order submissions so late provider responses cannot
-- overwrite manager reconciliation or a recovered attempt.
ALTER TABLE "ExternalOrder"
  ADD COLUMN "submissionToken" TEXT,
  ADD COLUMN "submissionStartedAt" TIMESTAMP(3);

CREATE INDEX "ExternalOrder_submissionStartedAt_idx"
  ON "ExternalOrder"("submissionStartedAt");
