CREATE TABLE "PackingCheck" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "expectedQuantity" INTEGER NOT NULL,
  "verifiedQuantity" INTEGER NOT NULL,
  "instructionsAcknowledged" BOOLEAN NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorLabel" TEXT,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackingCheck_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PackingCheck_quantity_check" CHECK ("expectedQuantity" > 0 AND "verifiedQuantity" = "expectedQuantity")
);
CREATE UNIQUE INDEX "PackingCheck_orderId_orderItemId_key" ON "PackingCheck"("orderId", "orderItemId");
CREATE INDEX "PackingCheck_orderId_verifiedAt_idx" ON "PackingCheck"("orderId", "verifiedAt");
ALTER TABLE "PackingCheck" ADD CONSTRAINT "PackingCheck_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackingCheck" ADD CONSTRAINT "PackingCheck_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
