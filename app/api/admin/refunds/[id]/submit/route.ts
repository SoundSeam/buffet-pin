import { RefundIntentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refundPaidOrder } from "@/lib/orders/refunds";
import { getStaffUser } from "@/lib/supabase/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser("REFUND_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const intent = await db.refundIntent.findUnique({ where: { id: (await params).id } });
  if (!intent) return NextResponse.json({ ok: false }, { status: 404 });
  if (intent.status !== RefundIntentStatus.PENDING) return NextResponse.json({ ok: false, error: { code: "REFUND_NOT_PENDING" } }, { status: 409 });
  const result = await refundPaidOrder({ orderId: intent.orderId, requestKey: intent.requestKey, reason: intent.reason, amountCents: intent.amountCents, actorId: actor.staff.id, actorLabel: actor.staff.displayName });
  return NextResponse.json({ ok: true, data: result });
}
