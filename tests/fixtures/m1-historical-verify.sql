DO $$
DECLARE
  preserved RECORD;
BEGIN
  SELECT * INTO preserved FROM "Order" WHERE "id" = 'm1-legacy-order';
  IF preserved."publicCode" <> 'LEGACYCODE1'
    OR preserved."itemsSubtotalCents" <> 2500
    OR preserved."taxCents" <> 374
    OR preserved."deliveryFeeCents" <> 500
    OR preserved."tipCents" <> 300
    OR preserved."totalCents" <> 3674
    OR preserved."trackingToken" IS NULL
    OR preserved."orderNumber" IS NULL
    OR preserved."trackingToken" = preserved."publicCode"
    OR preserved."productionStatus" <> 'PREPARING'
    OR preserved."dispatchStatus" <> 'UNASSIGNED'
    OR preserved."legacyPublicTrackingEnabled" IS NOT TRUE
  THEN
    RAISE EXCEPTION 'M1 migration did not preserve/backfill the historical order';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Order" WHERE "id" = 'm1-legacy-delivered' AND "productionStatus" = 'AT_DISPATCH_DESK' AND "dispatchStatus" = 'DELIVERED')
    OR NOT EXISTS (SELECT 1 FROM "Order" WHERE "id" = 'm1-legacy-rejected' AND "productionStatus" = 'REJECTED' AND "dispatchStatus" = 'CANCELLED')
    OR NOT EXISTS (SELECT 1 FROM "Order" WHERE "id" = 'm1-legacy-cancelled' AND "productionStatus" = 'CANCELLED' AND "dispatchStatus" = 'CANCELLED')
  THEN
    RAISE EXCEPTION 'M1 migration did not conservatively map historical lifecycle state';
  END IF;
END $$;
