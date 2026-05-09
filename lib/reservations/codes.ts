import { randomInt } from "crypto";

const CONFIRMATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateConfirmationCode(length = 8): string {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += CONFIRMATION_CODE_ALPHABET[randomInt(CONFIRMATION_CODE_ALPHABET.length)];
  }

  return code;
}
