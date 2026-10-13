import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

export async function claimPaymentWebhookEvent(
  client: PrismaClient,
  eventId: string,
  now = new Date(),
) {
  const token = randomUUID();
  const claimed = await client.paymentWebhookEvent.updateMany({
    where: {
      id: eventId,
      processedAt: null,
      OR: [
        { processingStartedAt: null },
        { processingStartedAt: { lte: new Date(now.getTime() - 5 * 60_000) } },
      ],
    },
    data: { processingStartedAt: now, processingToken: token },
  });
  if (claimed.count === 1) return { status: "CLAIMED" as const, token };
  const current = await client.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } });
  return { status: current.processedAt ? ("PROCESSED" as const) : ("PROCESSING" as const), token: null };
}

export async function releaseUnprocessedPaymentWebhookEvent(
  client: PrismaClient,
  eventId: string,
  token: string,
) {
  await client.paymentWebhookEvent.updateMany({
    where: { id: eventId, processingToken: token, processedAt: null },
    data: { processingStartedAt: null, processingToken: null },
  });
}
