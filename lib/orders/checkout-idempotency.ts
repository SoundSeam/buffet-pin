import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function checkoutRequestFingerprint(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}

export function checkoutIdempotencyMatches(
  payment: { checkoutRequestFingerprint: string | null },
  fingerprint: string,
) {
  return payment.checkoutRequestFingerprint === fingerprint;
}
