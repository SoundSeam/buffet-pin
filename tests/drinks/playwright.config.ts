import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "page.spec.ts",
  workers: 1,
  webServer: process.env.DRINKS_TEST_URL ? undefined : { command: "node tests/drinks/server.mjs", cwd: resolve(__dirname, "../.."), url: "http://localhost:3117/drinks", timeout: 60_000 },
  use: { baseURL: process.env.DRINKS_TEST_URL || "http://localhost:3117", browserName: "chromium" },
});
