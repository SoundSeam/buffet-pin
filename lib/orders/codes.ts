import { randomInt } from "crypto";

const PUBLIC_ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PUBLIC_ORDER_CODE_LENGTH = 10;

export function generatePublicOrderCode(
  length = PUBLIC_ORDER_CODE_LENGTH,
): string {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += PUBLIC_ORDER_CODE_ALPHABET[
      randomInt(PUBLIC_ORDER_CODE_ALPHABET.length)
    ];
  }

  return code;
}

export function normalizePublicOrderCode(publicCode: string): string {
  return publicCode.trim().toUpperCase();
}
