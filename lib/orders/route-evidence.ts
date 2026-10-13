import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getDriverSessionSecret } from "@/lib/env";

export type RouteSuggestionEvidence = {
  driverId: string;
  orderIds: string[];
  explanation: string;
  routingStatus: "ROUTED" | "MANUAL_FALLBACK";
  durationSeconds: number | null;
  distanceMeters: number | null;
  issuedAt: number;
};

const MAX_AGE_MS = 5 * 60_000;

function signature(encoded: string, secret: string) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

export function signRouteSuggestionEvidence(
  input: Omit<RouteSuggestionEvidence, "issuedAt">,
  secret = getDriverSessionSecret(),
) {
  const encoded = Buffer.from(JSON.stringify({ ...input, issuedAt: Date.now() })).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyRouteSuggestionEvidence(
  token: string,
  expected: { driverId: string; orderIds: string[] },
  secret = getDriverSessionSecret(),
) {
  const [encoded, actualSignature] = token.split(".");
  if (!encoded || !actualSignature) return null;
  const expectedSignature = signature(encoded, secret);
  const actual = Buffer.from(actualSignature);
  const wanted = Buffer.from(expectedSignature);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  try {
    const evidence = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as RouteSuggestionEvidence;
    if (
      evidence.driverId !== expected.driverId ||
      evidence.orderIds.length !== expected.orderIds.length ||
      evidence.orderIds.some((id, index) => id !== expected.orderIds[index]) ||
      !["ROUTED", "MANUAL_FALLBACK"].includes(evidence.routingStatus) ||
      !Number.isFinite(evidence.issuedAt) ||
      Date.now() - evidence.issuedAt > MAX_AGE_MS ||
      evidence.issuedAt > Date.now() + 30_000
    ) return null;
    return evidence;
  } catch {
    return null;
  }
}
