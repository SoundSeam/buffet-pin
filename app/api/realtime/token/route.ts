import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getDriverSession } from "@/lib/driver-access";
import { getEnv } from "@/lib/env";
import { adminUpdatesChannel, opaqueEntityChannel } from "@/lib/realtime/channels";
import { createRealtimeAuthorizationToken } from "@/lib/realtime/token";
import { parseTrackingCredential } from "@/lib/orders/tracking-credential";
import { getStaffUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("admin") }).strict(),
  z.object({ scope: z.literal("driver") }).strict(),
  z.object({ scope: z.literal("order"), credential: z.string().min(1).max(256) }).strict(),
]);

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: "INVALID_SCOPE" } }, { status: 400 });

  const env = getEnv();
  if (env.NEXT_PUBLIC_REALTIME_MODE !== "appsync" || !env.NEXT_PUBLIC_APPSYNC_EVENTS_HTTP_URL || !env.NEXT_PUBLIC_APPSYNC_EVENTS_REALTIME_URL || !env.REALTIME_SIGNING_SECRET) {
    return NextResponse.json({ ok: false, error: { code: "REALTIME_DISABLED" } }, { status: 503 });
  }

  let channel: string;
  if (parsed.data.scope === "admin") {
    if (!(await getStaffUser("ORDERS_READ"))) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    channel = adminUpdatesChannel;
  } else if (parsed.data.scope === "driver") {
    const session = await getDriverSession();
    if (!session) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    channel = `/updates/driver/${session.driver.id}`;
  } else {
    const credential = parseTrackingCredential(parsed.data.credential);
    if (!credential) return NextResponse.json({ ok: false, error: { code: "INVALID_ORDER" } }, { status: 400 });
    const order = await db.order.findFirst({
      where: credential.kind === "token" ? { trackingToken: credential.value } : { publicCode: credential.value, legacyPublicTrackingEnabled: true },
      select: { id: true },
    });
    if (!order) return NextResponse.json({ ok: false, error: { code: "ORDER_NOT_FOUND" } }, { status: 404 });
    channel = opaqueEntityChannel("order", order.id, env.REALTIME_SIGNING_SECRET);
  }

  const authorization = createRealtimeAuthorizationToken(channel, parsed.data.scope);
  return NextResponse.json({
    ok: true,
    data: {
      channel,
      authorizationToken: authorization.token,
      expiresAt: new Date(authorization.expiresAt * 1000).toISOString(),
      httpUrl: env.NEXT_PUBLIC_APPSYNC_EVENTS_HTTP_URL,
      realtimeUrl: env.NEXT_PUBLIC_APPSYNC_EVENTS_REALTIME_URL,
    },
  });
}
