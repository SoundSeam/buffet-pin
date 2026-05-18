UPDATE "Settings"
SET
  "minPartySize" = 6,
  "maxPartySize" = 15,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "minPartySize" = 5
  AND "maxPartySize" = 12;
