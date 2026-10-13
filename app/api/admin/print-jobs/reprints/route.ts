import { OrderActorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { confirmReprintPrinted, createReprintIntent } from "@/lib/orders/print-jobs";
import { getStaffUser } from "@/lib/supabase/auth";

const createSchema = z.object({ orderId: z.string().min(1), requestKey: z.string().min(8), reason: z.string().trim().min(3).max(300) });
const confirmSchema = z.object({ jobId: z.string().min(1), reason: z.string().trim().min(3).max(300) });
const actorInput = (actor: NonNullable<Awaited<ReturnType<typeof getStaffUser>>>) => ({ actorType: OrderActorType.ADMIN, actorId: actor.staff.id, actorLabel: actor.staff.displayName });

export async function POST(request: Request) {
  const actor = await getStaffUser("PRINT_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const job = await createReprintIntent(db, { ...parsed.data, actor: actorInput(actor) });
  return NextResponse.json({ ok: true, data: { job, ticketLabel: `REPRINT — ${parsed.data.reason}` } });
}

export async function PATCH(request: Request) {
  const actor = await getStaffUser("PRINT_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = confirmSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const job = await confirmReprintPrinted(db, { ...parsed.data, actor: actorInput(actor) });
  return NextResponse.json({ ok: true, data: { job } });
}
