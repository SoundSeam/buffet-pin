import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, status: "healthy" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, status: "unhealthy" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
