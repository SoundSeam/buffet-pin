import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const cronSecret = randomBytes(32).toString("hex");
const driverSecret = randomBytes(32).toString("hex");

const safeBuildEnvironment = {
  ...process.env,
  NODE_ENV: "production",
  APP_URL: "https://build.invalid",
  ADMIN_EMAILS: "build-admin@example.invalid",
  CRON_SECRET: cronSecret,
  DRIVER_SESSION_SECRET: driverSecret,
  DATABASE_URL: "postgresql://build:build@127.0.0.1:5432/buffet_pin_build?connect_timeout=1",
  DIRECT_URL: "postgresql://build:build@127.0.0.1:5432/buffet_pin_build?connect_timeout=1",
  NEXT_PUBLIC_SUPABASE_URL: "https://build.invalid",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "build-only-publishable-key",
  GEOCODING_PROVIDER: "none",
  CLOVER_ENV: "",
  CLOVER_CHECKOUT_MODE: "hosted",
  CLOVER_MERCHANT_ID: "",
  CLOVER_PUBLIC_ACCESS_KEY: "",
  CLOVER_PRIVATE_TOKEN: "",
  CLOVER_PLATFORM_TOKEN: "",
  CLOVER_ECOMMERCE_PRIVATE_TOKEN: "",
  CLOVER_PLATFORM_WEBHOOK_AUTH: "",
  CLOVER_WEBHOOK_SECRET: "",
  CLOVER_API_BASE_URL: "",
  CLOVER_TEST_CHARGE_CURRENCY: "",
  ORDERING_TEST_BYPASS: "false",
  PROVIDER_MODE: "real",
  FAILURE_INJECTION_ENABLED: "false",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  TWILIO_FROM_NUMBER: "",
};

const result = spawnSync("npm", ["run", "build"], {
  env: safeBuildEnvironment,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
