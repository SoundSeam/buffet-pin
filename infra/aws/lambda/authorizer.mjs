import { createHmac, timingSafeEqual } from "node:crypto";

import { readSecret } from "./common.mjs";

function verify(token, secret) {
  const [encoded, supplied] = String(token ?? "").split(".");
  if (!encoded || !supplied) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof payload.channel !== "string" || typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function handler(event) {
  const secret = await readSecret(process.env.REALTIME_SECRET_ARN);
  const payload = verify(event.authorizationToken, secret);
  const operation = event.requestContext?.operation;
  const channel = event.requestContext?.channel;
  const isAuthorized = Boolean(
    payload &&
      (operation === "EVENT_CONNECT" ||
        (operation === "EVENT_SUBSCRIBE" && channel === payload.channel)),
  );
  return {
    isAuthorized,
    handlerContext: isAuthorized ? { scope: payload.scope ?? "entity" } : undefined,
    ttlOverride: isAuthorized ? 60 : 0,
  };
}
