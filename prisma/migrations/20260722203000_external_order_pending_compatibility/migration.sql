-- Pre-fencing PENDING rows cannot prove an active owner after deployment.
-- Preserve them as explicit UNKNOWN work for provider reconciliation.
UPDATE "ExternalOrder"
SET "state" = 'UNKNOWN'
WHERE "state" = 'PENDING'
  AND "submissionToken" IS NULL;
