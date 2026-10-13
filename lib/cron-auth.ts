import { timingSafeEqual } from "node:crypto";
import { getCronSecret } from "@/lib/env";

export function isCronAuthorized(request: Request) {
  const secret = getCronSecret();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret) return false;
  const expected = Buffer.from(secret); const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
