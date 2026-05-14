import { randomInt, timingSafeEqual } from "crypto";

const MANAGE_TOKEN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const MANAGE_TOKEN_LENGTH = 6;

export function generateManageToken(length = MANAGE_TOKEN_LENGTH): string {
  let token = "";

  for (let index = 0; index < length; index += 1) {
    token += MANAGE_TOKEN_ALPHABET[randomInt(MANAGE_TOKEN_ALPHABET.length)];
  }

  return token;
}

export function safeTokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
