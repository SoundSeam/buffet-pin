import { OperationalAlertStatus, OrderActorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";

const schema = z.object({
  action: z.enum(["ACKNOWLEDGE", "RESOLVE"]),
  reason: z.string().trim().min(1).max(1000),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUserWithAnyCapability([
    "SETTINGS_WRITE",
    "DEV_TOOLS",
  ]);
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR" } },
      { status: 400 },
    );
  const id = (await params).id;
  const variance = await db.$transaction(async (tx) => {
    const current = await tx.reconciliationVariance.findUnique({
      where: { id },
    });
    if (!current) return null;
    const now = new Date();
    const status =
      parsed.data.action === "RESOLVE"
        ? OperationalAlertStatus.RESOLVED
        : OperationalAlertStatus.ACKNOWLEDGED;
    const updated = await tx.reconciliationVariance.update({
      where: { id },
      data: {
        status,
        acknowledgedAt: current.acknowledgedAt ?? now,
        acknowledgedBy: current.acknowledgedBy ?? actor.staff.id,
        ...(status === OperationalAlertStatus.RESOLVED
          ? {
              resolvedAt: now,
              resolvedBy: actor.staff.id,
              resolutionNote: parsed.data.reason,
            }
          : {}),
      },
    });
    await tx.operationalAlert.updateMany({
      where: { alertKey: current.alertKey },
      data: {
        status,
        acknowledgedAt: current.acknowledgedAt ?? now,
        acknowledgedBy: current.acknowledgedBy ?? actor.staff.id,
        ...(status === OperationalAlertStatus.RESOLVED
          ? { resolvedAt: now, resolutionNote: parsed.data.reason }
          : {}),
      },
    });
    await tx.operationalAuditEvent.create({
      data: {
        actorType: OrderActorType.ADMIN,
        actorId: actor.staff.id,
        actorLabel: actor.staff.displayName,
        eventType: `RECONCILIATION_VARIANCE_${parsed.data.action}`,
        entityType: "ReconciliationVariance",
        entityId: id,
        reason: parsed.data.reason,
      },
    });
    return updated;
  });
  return variance
    ? NextResponse.json({ ok: true, data: { variance } })
    : NextResponse.json({ ok: false }, { status: 404 });
}
