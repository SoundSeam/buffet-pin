import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";

export const MACHINE_TEST_GRANT_COOKIE = "buffet_pin_machine_test_grant";
export const MACHINE_TEST_GRANT_TTL_SECONDS = 15 * 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueMachineTestGrant(
  actor: { staffId: string; label: string | null },
  client: PrismaClient | Prisma.TransactionClient = db,
) {
  const now = new Date();
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + MACHINE_TEST_GRANT_TTL_SECONDS * 1000);

  await client.machineTestGrant.updateMany({
    where: {
      createdByStaffId: actor.staffId,
      consumedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });

  const grant = await client.machineTestGrant.create({
    data: {
      tokenHash: hashToken(rawToken),
      createdByStaffId: actor.staffId,
      createdByLabel: actor.label,
      expiresAt,
    },
  });

  await client.operationalAuditEvent.create({
    data: {
      actorType: "ADMIN",
      actorId: actor.staffId,
      actorLabel: actor.label,
      eventType: "MACHINE_TEST_GRANT_ISSUED",
      entityType: "MachineTestGrant",
      entityId: grant.id,
      reason: "Owner-approved deployed Clover/SP700 test",
      metadata: { expiresAt: expiresAt.toISOString(), maximumOrders: 1 },
    },
  });

  return { grant, rawToken };
}

export async function consumeMachineTestGrantInTransaction(
  tx: Prisma.TransactionClient,
  rawToken: string | null,
) {
  if (!rawToken) return null;

  const now = new Date();
  const grant = await tx.machineTestGrant.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (
    !grant ||
    grant.consumedAt ||
    grant.revokedAt ||
    grant.expiresAt <= now
  ) {
    return null;
  }

  const claimed = await tx.machineTestGrant.updateMany({
    where: {
      id: grant.id,
      consumedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt: now },
  });

  return claimed.count === 1 ? { ...grant, consumedAt: now } : null;
}

export async function attachMachineTestGrantToOrderInTransaction(
  tx: Prisma.TransactionClient,
  grantId: string,
  orderId: string,
) {
  await tx.machineTestGrant.update({
    where: { id: grantId },
    data: { orderId },
  });
  await tx.operationalAuditEvent.create({
    data: {
      actorType: "SYSTEM",
      eventType: "MACHINE_TEST_GRANT_CONSUMED",
      entityType: "MachineTestGrant",
      entityId: grantId,
      reason: "One deployed test checkout admitted while public ordering remained off",
      metadata: { orderId },
    },
  });
}
