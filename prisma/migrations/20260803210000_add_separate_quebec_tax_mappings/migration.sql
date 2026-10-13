-- Quebec checkout applies GST and QST as separate Clover tax rates. Keep the
-- legacy combined-tax key for compatibility with any prior mapping evidence.
ALTER TABLE "CatalogConfiguration"
  ADD COLUMN "requiredGstTaxMappingKey" TEXT NOT NULL DEFAULT 'quebec-gst',
  ADD COLUMN "requiredQstTaxMappingKey" TEXT NOT NULL DEFAULT 'quebec-qst';
