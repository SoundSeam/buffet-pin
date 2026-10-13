import { describe, expect, it } from "vitest";
import { validateEnv } from "../../lib/env";

const productionBase = {
  NODE_ENV: "production",
  APP_URL: "https://orders.example.invalid",
  CRON_SECRET: "production-cron-secret-with-more-than-32-characters",
  DRIVER_SESSION_SECRET: "production-driver-secret-with-more-than-32-characters",
  DATABASE_URL: "postgresql://app:secret@db.example.invalid/app",
  DIRECT_URL: "postgresql://app:secret@db.example.invalid/app",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
} satisfies NodeJS.ProcessEnv;

describe("production environment guardrails", () => {
  it.each([
    ["ORDERING_TEST_BYPASS", "true", "ORDERING_TEST_BYPASS is not allowed"],
    ["PROVIDER_MODE", "fake", "PROVIDER_MODE must be real"],
    ["FAILURE_INJECTION_ENABLED", "true", "FAILURE_INJECTION_ENABLED is not allowed"],
    ["CLOVER_ENV", "sandbox", "CLOVER_ENV=sandbox is not allowed"],
    ["CLOVER_API_BASE_URL", "http://localhost:9999", "CLOVER_API_BASE_URL overrides are not allowed"],
    ["CLOVER_TEST_CHARGE_CURRENCY", "USD", "CLOVER_TEST_CHARGE_CURRENCY is not allowed"],
  ])("rejects %s=%s", (name, value, message) => {
    expect(() => validateEnv({ ...productionBase, [name]: value })).toThrow(message);
  });

  it("accepts the documented production-safe build environment", () => {
    expect(validateEnv({ ...productionBase, PROVIDER_MODE: "real" }).PROVIDER_MODE).toBe("real");
  });

  it("fails closed when the Resend order-email configuration is incomplete", () => {
    expect(() =>
      validateEnv({ ...productionBase, ORDER_EMAIL_PROVIDER: "resend" }),
    ).toThrow("RESEND_API_KEY is required");
  });

  it.each([
    ["APP_URL", undefined, "APP_URL is required"],
    ["CRON_SECRET", undefined, "CRON_SECRET is required"],
    ["DRIVER_SESSION_SECRET", undefined, "DRIVER_SESSION_SECRET is required"],
    ["APP_URL", "http://localhost:3000", "APP_URL must use HTTPS"],
    ["CRON_SECRET", "short", "CRON_SECRET must be at least 32 characters"],
    [
      "DRIVER_SESSION_SECRET",
      "replace-with-a-random-32-plus-character-secret",
      "DRIVER_SESSION_SECRET must be at least 32 characters and not be a placeholder",
    ],
  ])("rejects missing or weak production %s", (name, value, message) => {
    const source = { ...productionBase, [name]: value };
    expect(() => validateEnv(source)).toThrow(message);
  });

  it("requires distinct production signing secrets", () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        DRIVER_SESSION_SECRET: productionBase.CRON_SECRET,
      }),
    ).toThrow("CRON_SECRET and DRIVER_SESSION_SECRET must be distinct");
  });

  it("rejects partial Clover production configuration", () => {
    expect(() =>
      validateEnv({ ...productionBase, CLOVER_ENV: "production" }),
    ).toThrow("CLOVER_MERCHANT_ID is required");
  });

  it("allows deterministic fakes only outside production", () => {
    const parsed = validateEnv({
      ...productionBase,
      NODE_ENV: "test",
      PROVIDER_MODE: "fake",
      FAILURE_INJECTION_ENABLED: "true",
    });
    expect(parsed.PROVIDER_MODE).toBe("fake");
    expect(parsed.FAILURE_INJECTION_ENABLED).toBe(true);
  });
});
