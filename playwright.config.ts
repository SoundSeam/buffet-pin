import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: ["reservation-switch.spec.ts", "reservation-party-size.spec.ts"],
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  webServer: {
    command: "node tests/browser/workflow-server.mjs",
    url: "http://localhost:3100/dev/fake-order-flow",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
