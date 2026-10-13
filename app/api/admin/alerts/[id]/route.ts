import { OperationalAlertStatus, OrderActorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";

const schema = z.object({
  action: z.enum(["ACKNOWLEDGE", "RESOLVE"]),
  note: z.string().trim().min(1).max(1000),
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
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const id = (await params).id;
  const current = await db.operationalAlert.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ ok: false }, { status: 404 });
  const sourceManagedCategories = new Set([
    "PAID_UNPRINTED",
    "PAYMENT_UNKNOWN",
    "REFUND_UNKNOWN",
    "STUCK_PRODUCTION",
    "LATE_DELIVERY",
    "NOTIFICATION_FAILED",
    "CATALOG_MISMATCH",
    "ROUTE_EXCEPTION",
    "RECONCILIATION_REQUIRED",
    "RECONCILIATION_VARIANCE",
  ]);
  if (
    parsed.data.action === "RESOLVE" &&
    sourceManagedCategories.has(current.category)
  )
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SOURCE_RESOLUTION_REQUIRED",
          message:
            "Resolve the source condition; the scanner will close this alert.",
        },
      },
      { status: 409 },
    );
  const now = new Date();
  const alert = await db.$transaction(async (tx) => {
    const updated = await tx.operationalAlert.update({
      where: { id },
      data:
        parsed.data.action === "ACKNOWLEDGE"
          ? {
              status: OperationalAlertStatus.ACKNOWLEDGED,
              acknowledgedAt: now,
              acknowledgedBy: actor.staff.id,
              resolutionNote: parsed.data.note,
            }
          : {
              status: OperationalAlertStatus.RESOLVED,
              resolvedAt: now,
              acknowledgedBy: actor.staff.id,
              resolutionNote: parsed.data.note,
            },
    });
    await tx.operationalAuditEvent.create({
      data: {
        actorType: OrderActorType.ADMIN,
        actorId: actor.staff.id,
        actorLabel: actor.staff.displayName,
        eventType: `OPERATIONAL_ALERT_${parsed.data.action}`,
        entityType: "OperationalAlert",
        entityId: id,
        reason: parsed.data.note,
        metadata: { category: current.category, alertKey: current.alertKey },
      },
    });
    return updated;
  });
  return NextResponse.json({ ok: true, data: { alert } });
}
