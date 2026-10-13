import { OrderActorType, StaffRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/supabase/auth";

const inputSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  displayName: z.string().min(1).max(120),
  role: z.nativeEnum(StaffRole),
  isActive: z.boolean().default(true),
});

export async function GET() {
  if (!(await getStaffUser("STAFF_WRITE"))) return NextResponse.json({ ok: false }, { status: 403 });
  const staff = await db.staffMember.findMany({ orderBy: [{ isActive: "desc" }, { email: "asc" }] });
  return NextResponse.json({ ok: true, data: { staff } });
}

export async function POST(request: Request) {
  const actor = await getStaffUser("STAFF_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR" } }, { status: 400 });
  const result = await db.$transaction(async (tx) => {
    const before = await tx.staffMember.findUnique({ where: { email: parsed.data.email } });
    const staff = await tx.staffMember.upsert({
      where: { email: parsed.data.email },
      create: parsed.data,
      update: parsed.data,
    });
    await tx.staffAccessEvent.create({
      data: {
        staffMemberId: staff.id,
        actorType: OrderActorType.ADMIN,
        actorId: actor.staff.id,
        actorLabel: actor.staff.displayName,
        eventType: before ? "STAFF_ACCESS_UPDATED" : "STAFF_ACCESS_CREATED",
        fromRole: before?.role,
        toRole: staff.role,
        metadata: { fromActive: before?.isActive ?? null, toActive: staff.isActive },
      },
    });
    return staff;
  });
  return NextResponse.json({ ok: true, data: { staff: result } });
}
