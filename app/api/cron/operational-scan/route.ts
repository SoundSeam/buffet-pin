import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getCronSecret } from "@/lib/env";
import { scanOperationalAlerts } from "@/lib/operations/alerts";
import { operationalLog } from "@/lib/operations/logging";

export async function GET(request: Request) {
  if (!getCronSecret()) return NextResponse.json({ ok: false, error: { code: "CRON_SECRET_MISSING" } }, { status: 503 });
  if (!isCronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await scanOperationalAlerts();
  operationalLog("operational_scan_complete", { candidateCount: result.candidateCount });
  return NextResponse.json({ ok: true, data: { scannedAt: result.scannedAt, candidateCount: result.candidateCount } });
}
