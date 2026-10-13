import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyRunBag } from "@/lib/orders/run-operations";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.object({ orderId: z.string().min(1) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser("DISPATCH_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { id } = await params;
  const stop = await verifyRunBag(db, { runId: id, orderId: parsed.data.orderId, actor: { id: actor.staff.id, label: actor.staff.displayName } });
  return NextResponse.json({ ok: true, data: { stop } });
}
