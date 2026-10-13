CREATE TABLE "MachineTestGrant" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdByStaffId" TEXT NOT NULL,
    "createdByLabel" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineTestGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MachineTestGrant_tokenHash_key" ON "MachineTestGrant"("tokenHash");
CREATE UNIQUE INDEX "MachineTestGrant_orderId_key" ON "MachineTestGrant"("orderId");
CREATE INDEX "MachineTestGrant_expiresAt_consumedAt_revokedAt_idx" ON "MachineTestGrant"("expiresAt", "consumedAt", "revokedAt");
CREATE INDEX "MachineTestGrant_createdByStaffId_createdAt_idx" ON "MachineTestGrant"("createdByStaffId", "createdAt");

ALTER TABLE "MachineTestGrant"
ADD CONSTRAINT "MachineTestGrant_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
