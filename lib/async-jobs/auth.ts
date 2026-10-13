import { createHmac, timingSafeEqual } from "node:crypto";

import { ASYNC_CALLBACK_MAX_AGE_SECONDS } from "./constants";

function signature(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function signAsyncCallback(secret: string, timestamp: string, body: string): string {
  return `HMAC-SHA256 ${timestamp}:${signature(secret, timestamp, body)}`;
}

export function verifyAsyncCallback(input: {
  secret: string;
  authorization: string | null;
  body: string;
  now?: Date;
}): boolean {
  const match = /^HMAC-SHA256 (\d+):([a-f0-9]{64})$/.exec(input.authorization ?? "");
  if (!match) return false;
  const timestamp = match[1];
  const provided = match[2];
  const ageSeconds = Math.abs((input.now ?? new Date()).getTime() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > ASYNC_CALLBACK_MAX_AGE_SECONDS) return false;
  const expected = signature(input.secret, timestamp, input.body);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

