import { postSignedCallback } from "./common.mjs";

export async function handler() {
  return postSignedCallback("/api/internal/async-jobs/recover", {});
}
