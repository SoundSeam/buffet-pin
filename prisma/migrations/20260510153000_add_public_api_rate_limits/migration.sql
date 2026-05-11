-- CreateTable
CREATE TABLE "PublicApiRateLimit" (
    "scope" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicApiRateLimit_pkey" PRIMARY KEY ("scope","identifierHash")
);

-- CreateIndex
CREATE INDEX "PublicApiRateLimit_expiresAt_idx" ON "PublicApiRateLimit"("expiresAt");
