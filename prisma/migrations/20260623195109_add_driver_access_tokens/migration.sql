-- AlterTable
ALTER TABLE "Driver" ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DriverAccessToken" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DriverAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverAccessToken_tokenHash_key" ON "DriverAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DriverAccessToken_driverId_revokedAt_idx" ON "DriverAccessToken"("driverId", "revokedAt");

-- AddForeignKey
ALTER TABLE "DriverAccessToken" ADD CONSTRAINT "DriverAccessToken_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
