import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: { baseURL: "http://localhost:3111", ...devices["Desktop Chrome"] },
  webServer: { command: "node tests/browser/server.mjs", url: "http://localhost:3111/reservation", timeout: 120_000 },
});
