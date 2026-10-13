import { OrderActorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { confirmFallbackPrint, createFallbackPrintIntent } from "@/lib/orders/print-jobs";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.object({ orderId: z.string().min(1), requestKey: z.string().min(1), reason: z.string().min(3).max(300) });
const confirmSchema = z.object({ jobId: z.string().min(1), reason: z.string().min(3).max(300) });

export async function POST(request: Request) {
  const actor = await getStaffUser("PRINT_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const job = await createFallbackPrintIntent(db, {
    ...parsed.data,
    actor: { actorType: OrderActorType.ADMIN, actorId: actor.staff.id, actorLabel: actor.staff.displayName },
  });
  return NextResponse.json({ ok: true, data: { job } });
}

export async function PATCH(request: Request) {
  const actor = await getStaffUser("PRINT_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = confirmSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const job = await confirmFallbackPrint(db, { ...parsed.data, actor: { actorType: OrderActorType.ADMIN, actorId: actor.staff.id, actorLabel: actor.staff.displayName } });
  return NextResponse.json({ ok: true, data: { job } });
}
