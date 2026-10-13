import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveRefundIntent, OrderRefundError } from "@/lib/orders/refunds";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.object({ succeeded: z.boolean(), providerRefundId: z.string().trim().min(1).optional(), reason: z.string().trim().min(1).max(1000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser("REFUND_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || (parsed.data.succeeded && !parsed.data.providerRefundId)) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR" } }, { status: 400 });
  try {
    const intent = await resolveRefundIntent({ intentId: (await params).id, ...parsed.data, actorId: actor.staff.id, actorLabel: actor.staff.displayName });
    return NextResponse.json({ ok: true, data: { intent } });
  } catch (error) {
    if (error instanceof OrderRefundError) return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: 409 });
    throw error;
  }
}
