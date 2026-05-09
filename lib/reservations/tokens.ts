import { randomBytes, timingSafeEqual } from "crypto";

export function generateManageToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function safeTokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
