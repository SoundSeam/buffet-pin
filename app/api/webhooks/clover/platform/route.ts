import { createHash, timingSafeEqual } from "node:crypto";
import { PaymentProvider, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { createCloverClient } from "@/lib/clover/client";
import { confirmOrderPrintedInTransaction } from "@/lib/clover/print-orders";
import { db } from "@/lib/db";
import { getCloverPlatformWebhookAuth } from "@/lib/env";
import { claimPaymentWebhookEvent } from "@/lib/clover/webhook-claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    verificationCode?: string;
    appId?: string;
    merchants?: Record<string, Array<{ objectId?: string; type?: string; ts?: number }>>;
  };
  if (payload.verificationCode && !payload.merchants) {
    return NextResponse.json({ ok: true });
  }
  const expected = getCloverPlatformWebhookAuth();
  const actual = request.headers.get("x-clover-auth") ?? "";
  if (!expected || !safeEqual(expected, actual)) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_CLOVER_AUTH" } }, { status: expected ? 401 : 503 });
  }
  const client = createCloverClient();
  let processed = 0;
  for (const [merchantId, updates] of Object.entries(payload.merchants ?? {})) {
    if (merchantId !== client.config.merchantId) continue;
    for (const update of updates) {
      if (!update.objectId || !update.type || !update.ts) continue;
      const providerEventId = `platform:${createHash("sha256").update(`${merchantId}:${update.objectId}:${update.type}:${update.ts}`).digest("hex")}`;
      let eventId: string;
      try {
        const event = await db.paymentWebhookEvent.create({
          data: { provider: PaymentProvider.CLOVER, providerEventId, eventType: `PLATFORM_${update.type}`, payload: payload as Prisma.InputJsonValue },
        });
        eventId = event.id;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await db.paymentWebhookEvent.findUniqueOrThrow({ where: { provider_providerEventId: { provider: PaymentProvider.CLOVER, providerEventId } } });
          if (existing.processedAt) continue;
          eventId = existing.id;
        } else {
          throw error;
        }
      }
      const claim = await claimPaymentWebhookEvent(db, eventId);
      if (claim.status !== "CLAIMED") continue;
      const [kind, objectId] = update.objectId.split(":", 2);
      if (kind === "O" && objectId) {
        const order = await client.get<{ lineItems?: { elements?: Array<{ printed?: boolean }> } }>(
          `/v3/merchants/${encodeURIComponent(merchantId)}/orders/${encodeURIComponent(objectId)}?expand=lineItems`,
        );
        const lines = order.lineItems?.elements ?? [];
        if (lines.length > 0 && lines.every((line) => line.printed === true)) {
          await db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "PaymentWebhookEvent" WHERE "id" = ${eventId} FOR UPDATE`;
            const claimedEvent = await tx.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } });
            if (claimedEvent.processedAt || claimedEvent.processingToken !== claim.token) return;
            await confirmOrderPrintedInTransaction(tx, objectId, { providerEventId, update, lineItems: lines });
            await tx.paymentWebhookEvent.update({ where: { id: eventId }, data: { processingStartedAt: null, processingToken: null, processedAt: new Date() } });
          });
          processed += 1;
          continue;
        }
      }
      await db.paymentWebhookEvent.updateMany({ where: { id: eventId, processingToken: claim.token, processedAt: null }, data: { processingStartedAt: null, processingToken: null, processedAt: new Date() } });
      processed += 1;
    }
  }
  return NextResponse.json({ ok: true, processed });
}
