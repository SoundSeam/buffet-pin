ALTER TABLE "DrinkItem" ALTER COLUMN "priceCents" DROP NOT NULL;
ALTER TABLE "DrinkItem" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "DrinkMenuEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrinkMenuEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DrinkMenuEvent_entityId_createdAt_idx" ON "DrinkMenuEvent"("entityId", "createdAt");
