import { PUBLIC_ORDER_CODE_LENGTH, normalizePublicOrderCode } from "@/lib/orders/codes";

export function parseTrackingCredential(value: string):
  | { kind: "token"; value: string }
  | { kind: "legacy"; value: string }
  | null {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(trimmed)) return { kind: "token", value: trimmed };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return { kind: "token", value: trimmed };
  }
  const legacy = normalizePublicOrderCode(trimmed);
  if (
    legacy.length === PUBLIC_ORDER_CODE_LENGTH &&
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/.test(legacy)
  ) {
    return { kind: "legacy", value: legacy };
  }
  return null;
}
