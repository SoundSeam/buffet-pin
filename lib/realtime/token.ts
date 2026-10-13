import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import { getEnv } from "@/lib/env";

export function createRealtimeAuthorizationToken(channel: string, scope: string) {
  const secret = getEnv().REALTIME_SIGNING_SECRET;
  if (!secret) throw new Error("Realtime signing is not configured.");
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const encoded = Buffer.from(JSON.stringify({ channel, scope, exp: expiresAt, jti: randomUUID() })).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return { token: `${encoded}.${signature}`, expiresAt };
}
