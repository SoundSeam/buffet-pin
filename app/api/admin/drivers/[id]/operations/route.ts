import { OrderActorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.object({
  zoneIds: z.array(z.string().min(1)).min(1),
  shift: z.object({ startsAt: z.coerce.date(), endsAt: z.coerce.date() }).refine((value) => value.endsAt > value.startsAt).optional(),
  reason: z.string().trim().min(1).max(500),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getStaffUser("DISPATCH_WRITE"))) return NextResponse.json({ ok: false }, { status: 403 });
  const driver = await db.driver.findUnique({ where: { id: (await params).id }, include: { zoneEligibilities: { include: { deliveryZone: true } }, shifts: { orderBy: { startsAt: "desc" }, take: 20 } } });
  return driver ? NextResponse.json({ ok: true, data: { driver } }) : NextResponse.json({ ok: false }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getStaffUser("DISPATCH_WRITE"); if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } }, { status: 400 });
  const driverId = (await params).id;
  const result = await db.$transaction(async (tx) => {
    const zones = await tx.deliveryZone.count({ where: { id: { in: parsed.data.zoneIds }, isActive: true } });
    if (zones !== new Set(parsed.data.zoneIds).size) throw new Error("Every zone must exist and be active.");
    await tx.driverZoneEligibility.updateMany({ where: { driverId }, data: { isActive: false } });
    for (const deliveryZoneId of [...new Set(parsed.data.zoneIds)]) await tx.driverZoneEligibility.upsert({ where: { driverId_deliveryZoneId: { driverId, deliveryZoneId } }, create: { driverId, deliveryZoneId }, update: { isActive: true } });
    if (parsed.data.shift) await tx.driverShift.create({ data: { driverId, ...parsed.data.shift } });
    await tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.ADMIN, actorId: actor.staff.id, actorLabel: actor.staff.displayName, eventType: "DRIVER_OPERATIONS_UPDATED", entityType: "Driver", entityId: driverId, reason: parsed.data.reason, metadata: { zoneIds: parsed.data.zoneIds, shift: parsed.data.shift ? { startsAt: parsed.data.shift.startsAt, endsAt: parsed.data.shift.endsAt } : null } } });
    return tx.driver.findUniqueOrThrow({ where: { id: driverId }, include: { zoneEligibilities: true, shifts: { orderBy: { startsAt: "desc" }, take: 20 } } });
  });
  return NextResponse.json({ ok: true, data: { driver: result } });
}
