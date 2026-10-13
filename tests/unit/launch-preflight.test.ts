import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/launch-preflight.mjs", import.meta.url));

const base = {
  APP_URL: "https://orders.example.test",
  ADMIN_EMAILS: "owner@buffetpin.test",
  CRON_SECRET: "cron-secret-that-is-longer-than-thirty-two-characters",
  DRIVER_SESSION_SECRET: "driver-secret-that-is-longer-than-thirty-two-characters",
  DATABASE_URL: "postgresql://runtime.example.test/db",
  DIRECT_URL: "postgresql://direct.example.test/db",
  NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.test",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  GEOCODING_PROVIDER: "google",
  GOOGLE_MAPS_API_KEY: "maps-key",
  CLOVER_CHECKOUT_MODE: "iframe",
  CLOVER_ENV: "sandbox",
  CLOVER_MERCHANT_ID: "merchant",
  CLOVER_PUBLIC_ACCESS_KEY: "public",
  CLOVER_PLATFORM_TOKEN: "platform",
  CLOVER_ECOMMERCE_PRIVATE_TOKEN: "ecommerce",
  CLOVER_WEBHOOK_SECRET: "hosted-webhook",
  CLOVER_PLATFORM_WEBHOOK_AUTH: "platform-webhook",
  PROVIDER_MODE: "real",
  ORDERING_TEST_BYPASS: "false",
  FAILURE_INJECTION_ENABLED: "false",
  CLOVER_API_BASE_URL: "",
  CLOVER_TEST_CHARGE_CURRENCY: "",
  TWILIO_ACCOUNT_SID: "account",
  TWILIO_AUTH_TOKEN: "token",
  TWILIO_FROM_NUMBER: "+15145550123",
};

function run(target: "sandbox" | "production", overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...base, ...overrides };
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete env[name];
  }
  return spawnSync(process.execPath, [script, `--target=${target}`], {
    env,
    encoding: "utf8",
  });
}

describe("launch preflight", () => {
  it("passes a complete sandbox configuration without printing secret values", () => {
    const result = run("sandbox");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Launch sandbox preflight PASS");
    expect(`${result.stdout}${result.stderr}`).not.toContain(base.CLOVER_PLATFORM_TOKEN);
  });

  it("reports missing launch configuration by name", () => {
    const result = run("sandbox", { DIRECT_URL: undefined, TWILIO_AUTH_TOKEN: undefined });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DIRECT_URL is missing");
    expect(result.stderr).toContain("TWILIO_AUTH_TOKEN is missing");
  });

  it("rejects sandbox and unsafe switches for production", () => {
    const result = run("production", {
      CLOVER_ENV: "sandbox",
      ORDERING_TEST_BYPASS: "true",
      CLOVER_TEST_CHARGE_CURRENCY: "USD",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CLOVER_ENV must be production");
    expect(result.stderr).toContain("ORDERING_TEST_BYPASS must be false");
    expect(result.stderr).toContain("CLOVER_TEST_CHARGE_CURRENCY is forbidden");
  });
});
