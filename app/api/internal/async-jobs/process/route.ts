import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAsyncCallback } from "@/lib/async-jobs/auth";
import { processAsyncJob } from "@/lib/async-jobs/processor";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const payloadSchema = z.object({ jobId: z.string().min(1).max(128) }).strict();

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

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: { code: "INVALID_JSON" } }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_JOB" } }, { status: 400 });
  }

  const result = await processAsyncJob(parsed.data.jobId);
  return NextResponse.json({ ok: true, data: result });
}
