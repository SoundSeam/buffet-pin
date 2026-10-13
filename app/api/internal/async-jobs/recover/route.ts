import { NextResponse } from "next/server";

import { verifyAsyncCallback } from "@/lib/async-jobs/auth";
import { recoverAsyncJobs } from "@/lib/async-jobs/dispatch";
import { getEnv } from "@/lib/env";
import { scanOperationalAlerts } from "@/lib/operations/alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.text();
  const secret = getEnv().ASYNC_CALLBACK_SECRET;
  if (!secret || !verifyAsyncCallback({
    secret,
    authorization: request.headers.get("authorization"),
    body,
  })) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const [jobs, operations] = await Promise.all([
    recoverAsyncJobs(200),
    scanOperationalAlerts(),
  ]);
  return NextResponse.json({ ok: true, data: { jobs, operations } });
}
