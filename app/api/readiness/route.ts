import { OperationalAlertSeverity, OperationalAlertStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [settings, criticalAlerts] = await Promise.all([
      db.restaurantOrderSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
      db.operationalAlert.count({ where: { severity: OperationalAlertSeverity.CRITICAL, status: { in: [OperationalAlertStatus.OPEN, OperationalAlertStatus.ACKNOWLEDGED] } } }),
    ]);
    const intakeEnabled = settings.onlineOrderingEnabled && !settings.intakePausedAt;
    return NextResponse.json({ ok: true, status: intakeEnabled && criticalAlerts === 0 ? "ready" : "intake_paused", intakeEnabled, intakePauseReason: settings.intakePauseReason, criticalAlertCount: criticalAlerts }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, status: "unhealthy" }, { status: 503 });
  }
}
