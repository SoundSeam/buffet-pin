import { OperationalAlertStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/supabase/auth";

export async function GET() {
  if (!(await getStaffUser("ORDERS_READ"))) return NextResponse.json({ ok: false }, { status: 403 });
  const alerts = await db.operationalAlert.findMany({ where: { status: { in: [OperationalAlertStatus.OPEN, OperationalAlertStatus.ACKNOWLEDGED] } }, orderBy: [{ severity: "desc" }, { firstSeenAt: "asc" }] });
  return NextResponse.json({ ok: true, data: { alerts } });
}
