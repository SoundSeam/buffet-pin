import { NextResponse } from "next/server";
import { z } from "zod";
import { refundPaidOrder, OrderRefundError } from "@/lib/orders/refunds";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.object({ requestKey: z.string().min(8).max(200), reason: z.string().trim().min(1).max(1000), amountCents: z.number().int().positive().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser("REFUND_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR" } }, { status: 400 });
  try {
    const result = await refundPaidOrder({ orderId: (await params).id, ...parsed.data, actorId: actor.staff.id, actorLabel: actor.staff.displayName });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof OrderRefundError) return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: 409 });
    throw error;
  }
}
