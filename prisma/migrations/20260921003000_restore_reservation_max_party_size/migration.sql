-- Authorized reservation-policy correction: preserve every existing booking and
-- all other settings. Migration history plus release evidence records this change.
BEGIN;
DO $$
BEGIN
  PERFORM 1 FROM "Settings" WHERE "id" = 1 FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM "Settings"
    WHERE "id" = 1 AND ("minPartySize" <> 6 OR "maxPartySize" NOT IN (12, 15))
  ) THEN
    RAISE EXCEPTION 'Unexpected reservation bounds; refusing to overwrite custom settings';
  END IF;
END $$;
UPDATE "Settings"
SET "maxPartySize" = 12, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 1 AND "minPartySize" = 6 AND "maxPartySize" = 15;
COMMIT;
