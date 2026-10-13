import "server-only";

import { z } from "zod";

const LOCAL_APP_URL = "http://localhost:3000";
const MIN_PRODUCTION_SECRET_LENGTH = 32;
const OBVIOUS_PLACEHOLDER = /(replace|change.?me|example|placeholder|your[_-]?secret)/i;

function trimToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeHttpUrl(value: unknown) {
  const trimmed = trimToUndefined(value);

  if (typeof trimmed !== "string") {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(localhost|127(?:\.\d{1,3}){3}|\[[0-9a-f:.]+\])(?::\d+)?(?:\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  return `https://${trimmed}`;
}

function normalizeBoolean(value: unknown) {
  const trimmed = trimToUndefined(value);

  if (typeof trimmed !== "string") {
    return trimmed;
  }

  switch (trimmed.toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return trimmed;
  }
}

const optionalString = z.preprocess(
  trimToUndefined,
  z.union([z.string().min(1), z.undefined()]),
).optional();
const optionalBoolean = z.preprocess(
  normalizeBoolean,
  z.union([z.boolean(), z.undefined()]),
).optional();
const optionalTestChargeCurrency = z.preprocess(
  (value) => {
    const trimmed = trimToUndefined(value);
    return typeof trimmed === "string" ? trimmed.toUpperCase() : trimmed;
  },
  z.union([z.enum(["USD"]), z.undefined()]),
).optional();
const optionalHttpUrl = z.preprocess(
  normalizeHttpUrl,
  z.union([
    z
      .string()
      .url()
      .refine((value) => {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      }, "Must be an absolute http(s) URL."),
    z.undefined(),
  ]),
).optional();

const envSchema = z
  .object({
    APP_URL: optionalHttpUrl,
    ADMIN_EMAILS: optionalString,
    CRON_SECRET: optionalString,
    DRIVER_SESSION_SECRET: optionalString,
    DATABASE_URL: z.string().trim().min(1),
    DIRECT_URL: optionalString,
    NEXT_PUBLIC_SUPABASE_URL: z
      .string()
      .trim()
      .url()
      .refine((value) => {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      }, "Must be an absolute http(s) URL."),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
    GEOCODING_PROVIDER: z
      .preprocess(trimToUndefined, z.enum(["google", "none"]).optional())
      .default("none"),
    GOOGLE_MAPS_API_KEY: optionalString,
    CLOVER_ENV: z.preprocess(
      trimToUndefined,
      z.union([z.enum(["sandbox", "production"]), z.undefined()]),
    ).optional(),
    CLOVER_CHECKOUT_MODE: z
      .preprocess(trimToUndefined, z.enum(["hosted", "iframe"]).optional())
      .default("hosted"),
    CLOVER_MERCHANT_ID: optionalString,
    CLOVER_PUBLIC_ACCESS_KEY: optionalString,
    CLOVER_PRIVATE_TOKEN: optionalString,
    CLOVER_PLATFORM_TOKEN: optionalString,
    CLOVER_ECOMMERCE_PRIVATE_TOKEN: optionalString,
    CLOVER_WEBHOOK_SECRET: optionalString,
    CLOVER_PLATFORM_WEBHOOK_AUTH: optionalString,
    CLOVER_API_BASE_URL: optionalHttpUrl,
    CLOVER_TEST_CHARGE_CURRENCY: optionalTestChargeCurrency,
    ORDERING_TEST_BYPASS: optionalBoolean.default(false),
    PROVIDER_MODE: z
      .preprocess(trimToUndefined, z.enum(["real", "fake"]).optional())
      .default("real"),
    FAILURE_INJECTION_ENABLED: optionalBoolean.default(false),
    ASYNC_JOBS_MODE: z
      .preprocess(trimToUndefined, z.enum(["inline", "shadow", "aws"]).optional())
      .default("inline"),
    AWS_REGION: z.preprocess(trimToUndefined, z.string().min(1).optional()).default("us-east-2"),
    AWS_ASYNC_ROLE_ARN: optionalString,
    AWS_CRITICAL_QUEUE_URL: optionalHttpUrl,
    AWS_CRITICAL_QUEUE_ARN: optionalString,
    AWS_NOTIFICATION_QUEUE_URL: optionalHttpUrl,
    AWS_NOTIFICATION_QUEUE_ARN: optionalString,
    AWS_SCHEDULER_GROUP_NAME: optionalString,
    AWS_SCHEDULER_ROLE_ARN: optionalString,
    AWS_SCHEDULER_DLQ_ARN: optionalString,
    ASYNC_CALLBACK_SECRET: optionalString,
    NEXT_PUBLIC_REALTIME_MODE: z
      .preprocess(trimToUndefined, z.enum(["poll", "appsync"]).optional())
      .default("poll"),
    NEXT_PUBLIC_APPSYNC_EVENTS_HTTP_URL: optionalHttpUrl,
    NEXT_PUBLIC_APPSYNC_EVENTS_REALTIME_URL: optionalHttpUrl,
    REALTIME_SIGNING_SECRET: optionalString,
    TWILIO_ACCOUNT_SID: optionalString,
    TWILIO_AUTH_TOKEN: optionalString,
    TWILIO_FROM_NUMBER: optionalString,
    ORDER_EMAIL_PROVIDER: z
      .preprocess(trimToUndefined, z.enum(["disabled", "resend"]).optional())
      .default("disabled"),
    RESEND_API_KEY: optionalString,
    ORDER_EMAIL_FROM: optionalString,
  });

export type AppEnv = z.infer<typeof envSchema>;

function isProductionEnvironment(source: NodeJS.ProcessEnv): boolean {
  return source.NODE_ENV === "production";
}

function parseEnv(source: NodeJS.ProcessEnv): AppEnv {
  return envSchema.parse(source);
}

function assertProductionEnvRequirements(
  env: AppEnv,
  source: NodeJS.ProcessEnv,
): void {
  if (!isProductionEnvironment(source)) {
    return;
  }

  const errors: string[] = [];

  if (!env.APP_URL) {
    errors.push("APP_URL is required in production.");
  } else if (new URL(env.APP_URL).protocol !== "https:") {
    errors.push("APP_URL must use HTTPS in production.");
  }

  if (!env.CRON_SECRET) {
    errors.push("CRON_SECRET is required in production.");
  } else if (
    env.CRON_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH ||
    OBVIOUS_PLACEHOLDER.test(env.CRON_SECRET)
  ) {
    errors.push("CRON_SECRET must be at least 32 characters and not be a placeholder.");
  }

  if (!env.DRIVER_SESSION_SECRET) {
    errors.push("DRIVER_SESSION_SECRET is required in production.");
  } else if (
    env.DRIVER_SESSION_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH ||
    OBVIOUS_PLACEHOLDER.test(env.DRIVER_SESSION_SECRET)
  ) {
    errors.push("DRIVER_SESSION_SECRET must be at least 32 characters and not be a placeholder.");
  }

  if (
    env.CRON_SECRET &&
    env.DRIVER_SESSION_SECRET &&
    env.CRON_SECRET === env.DRIVER_SESSION_SECRET
  ) {
    errors.push("CRON_SECRET and DRIVER_SESSION_SECRET must be distinct.");
  }

  if (env.CLOVER_TEST_CHARGE_CURRENCY) {
    errors.push("CLOVER_TEST_CHARGE_CURRENCY is not allowed in production.");
  }

  if (env.ORDER_EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) errors.push("RESEND_API_KEY is required when ORDER_EMAIL_PROVIDER=resend.");
    if (!env.ORDER_EMAIL_FROM) errors.push("ORDER_EMAIL_FROM is required when ORDER_EMAIL_PROVIDER=resend.");
  }

  if (env.ORDERING_TEST_BYPASS) {
    errors.push("ORDERING_TEST_BYPASS is not allowed in production.");
  }

  if (env.PROVIDER_MODE !== "real") {
    errors.push("PROVIDER_MODE must be real in production.");
  }

  if (env.FAILURE_INJECTION_ENABLED) {
    errors.push("FAILURE_INJECTION_ENABLED is not allowed in production.");
  }

  if (env.ASYNC_JOBS_MODE === "aws") {
    const requiredAsyncValues: Array<[string, string | undefined]> = [
      ["AWS_ASYNC_ROLE_ARN", env.AWS_ASYNC_ROLE_ARN],
      ["AWS_CRITICAL_QUEUE_URL", env.AWS_CRITICAL_QUEUE_URL],
      ["AWS_CRITICAL_QUEUE_ARN", env.AWS_CRITICAL_QUEUE_ARN],
      ["AWS_NOTIFICATION_QUEUE_URL", env.AWS_NOTIFICATION_QUEUE_URL],
      ["AWS_NOTIFICATION_QUEUE_ARN", env.AWS_NOTIFICATION_QUEUE_ARN],
      ["AWS_SCHEDULER_GROUP_NAME", env.AWS_SCHEDULER_GROUP_NAME],
      ["AWS_SCHEDULER_ROLE_ARN", env.AWS_SCHEDULER_ROLE_ARN],
      ["AWS_SCHEDULER_DLQ_ARN", env.AWS_SCHEDULER_DLQ_ARN],
      ["ASYNC_CALLBACK_SECRET", env.ASYNC_CALLBACK_SECRET],
    ];
    for (const [name, value] of requiredAsyncValues) {
      if (!value) errors.push(`${name} is required when ASYNC_JOBS_MODE=aws.`);
    }
  }

  if (env.NEXT_PUBLIC_REALTIME_MODE === "appsync") {
    if (!env.NEXT_PUBLIC_APPSYNC_EVENTS_HTTP_URL) {
      errors.push("NEXT_PUBLIC_APPSYNC_EVENTS_HTTP_URL is required for AppSync realtime.");
    }
    if (!env.NEXT_PUBLIC_APPSYNC_EVENTS_REALTIME_URL) {
      errors.push("NEXT_PUBLIC_APPSYNC_EVENTS_REALTIME_URL is required for AppSync realtime.");
    }
    if (!env.REALTIME_SIGNING_SECRET) {
      errors.push("REALTIME_SIGNING_SECRET is required for AppSync realtime.");
    }
  }

  if (env.CLOVER_ENV === "sandbox") {
    errors.push("CLOVER_ENV=sandbox is not allowed in production.");
  }

  if (env.CLOVER_API_BASE_URL) {
    errors.push("CLOVER_API_BASE_URL overrides are not allowed in production.");
  }

  const hasAnyCloverConfiguration = Boolean(
    env.CLOVER_ENV ||
      env.CLOVER_MERCHANT_ID ||
      env.CLOVER_PRIVATE_TOKEN ||
      env.CLOVER_PLATFORM_TOKEN ||
      env.CLOVER_ECOMMERCE_PRIVATE_TOKEN ||
      env.CLOVER_WEBHOOK_SECRET ||
      env.CLOVER_PLATFORM_WEBHOOK_AUTH ||
      env.CLOVER_PUBLIC_ACCESS_KEY,
  );
  if (hasAnyCloverConfiguration) {
    if (env.CLOVER_ENV !== "production") {
      errors.push("Configured Clover credentials require CLOVER_ENV=production in production.");
    }
    if (!env.CLOVER_MERCHANT_ID) {
      errors.push("CLOVER_MERCHANT_ID is required when Clover is configured in production.");
    }
    if (!env.CLOVER_PLATFORM_TOKEN) {
      errors.push("CLOVER_PLATFORM_TOKEN is required for Clover Platform APIs in production.");
    }
    if (!env.CLOVER_ECOMMERCE_PRIVATE_TOKEN) {
      errors.push("CLOVER_ECOMMERCE_PRIVATE_TOKEN is required for Clover Ecommerce in production.");
    }
    if (!env.CLOVER_WEBHOOK_SECRET) {
      errors.push("CLOVER_WEBHOOK_SECRET is required when Clover is configured in production.");
    }
    if (!env.CLOVER_PLATFORM_WEBHOOK_AUTH) {
      errors.push("CLOVER_PLATFORM_WEBHOOK_AUTH is required when Clover is configured in production.");
    }
    if (env.CLOVER_CHECKOUT_MODE !== "iframe") {
      errors.push("CLOVER_CHECKOUT_MODE=iframe is required for mapped-order production checkout.");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid production environment:\n- ${errors.join("\n- ")}`);
  }
}

export function validateEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const env = parseEnv(source);
  assertProductionEnvRequirements(env, source);
  return env;
}

let cachedEnv: AppEnv | null = null;

export function getEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (source !== process.env) {
    return validateEnv(source);
  }

  cachedEnv ??= validateEnv(source);
  return cachedEnv;
}

export function getAdminEmails(source: NodeJS.ProcessEnv = process.env): string[] {
  return (getEnv(source).ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export function getAppUrl(source: NodeJS.ProcessEnv = process.env): string {
  const currentEnv = getEnv(source);

  if (currentEnv.APP_URL) {
    return currentEnv.APP_URL;
  }

  if (isProductionEnvironment(source)) {
    throw new Error("APP_URL is required in production.");
  }

  return LOCAL_APP_URL;
}

export function getCronSecret(source: NodeJS.ProcessEnv = process.env): string | null {
  return getEnv(source).CRON_SECRET ?? null;
}

export function getDriverSessionSecret(source: NodeJS.ProcessEnv = process.env): string {
  const currentEnv = getEnv(source);
  const secret = currentEnv.DRIVER_SESSION_SECRET ?? currentEnv.CRON_SECRET;

  if (!secret) {
    if (isProductionEnvironment(source)) {
      throw new Error("DRIVER_SESSION_SECRET is required in production.");
    }

    return "local-driver-session-secret";
  }

  return secret;
}

export function isOrderingTestBypassEnabled(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return getEnv(source).ORDERING_TEST_BYPASS;
}

export function getProviderMode(
  source: NodeJS.ProcessEnv = process.env,
): "real" | "fake" {
  return getEnv(source).PROVIDER_MODE;
}

export function isFailureInjectionEnabled(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return getEnv(source).FAILURE_INJECTION_ENABLED;
}

export function getOrderCurrencyCode(source: NodeJS.ProcessEnv = process.env): "CAD" | "USD" {
  const currentEnv = getEnv(source);

  if (
    !isProductionEnvironment(source) &&
    currentEnv.CLOVER_ENV === "sandbox" &&
    currentEnv.CLOVER_TEST_CHARGE_CURRENCY
  ) {
    return currentEnv.CLOVER_TEST_CHARGE_CURRENCY;
  }

  return "CAD";
}

export function getGeocodingConfig(
  deliveryEnabled: boolean,
  source: NodeJS.ProcessEnv = process.env,
): { provider: "google"; googleMapsApiKey: string } | { provider: "none" } {
  const currentEnv = getEnv(source);

  if (currentEnv.GEOCODING_PROVIDER !== "google") {
    if (deliveryEnabled) {
      throw new Error(
        "Delivery geocoding is not configured. Set GEOCODING_PROVIDER=google and GOOGLE_MAPS_API_KEY.",
      );
    }

    return { provider: "none" };
  }

  if (!currentEnv.GOOGLE_MAPS_API_KEY) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY is required when GEOCODING_PROVIDER=google.",
    );
  }

  return {
    provider: "google",
    googleMapsApiKey: currentEnv.GOOGLE_MAPS_API_KEY,
  };
}

export type CloverConfig = {
  env: "sandbox" | "production";
  checkoutMode: "hosted" | "iframe";
  merchantId: string;
  publicAccessKey: string | null;
  privateToken: string;
  platformToken: string;
  webhookSecret: string | null;
  apiBaseUrl: string;
  ecommerceApiBaseUrl: string;
};

export function getCloverConfig(
  source: NodeJS.ProcessEnv = process.env,
): CloverConfig {
  const currentEnv = getEnv(source);
  const missingKeys = [
    !currentEnv.CLOVER_ENV ? "CLOVER_ENV" : null,
    !currentEnv.CLOVER_MERCHANT_ID ? "CLOVER_MERCHANT_ID" : null,
    !(currentEnv.CLOVER_PLATFORM_TOKEN ?? currentEnv.CLOVER_PRIVATE_TOKEN) ? "CLOVER_PLATFORM_TOKEN" : null,
    !(currentEnv.CLOVER_ECOMMERCE_PRIVATE_TOKEN ?? currentEnv.CLOVER_PRIVATE_TOKEN) ? "CLOVER_ECOMMERCE_PRIVATE_TOKEN" : null,
  ].filter(Boolean);

  if (missingKeys.length > 0) {
    throw new Error(
      `Clover Hosted Checkout is not configured. Missing: ${missingKeys.join(", ")}.`,
    );
  }

  const cloverEnv = currentEnv.CLOVER_ENV!;

  return {
    env: cloverEnv,
    checkoutMode: currentEnv.CLOVER_CHECKOUT_MODE,
    merchantId: currentEnv.CLOVER_MERCHANT_ID!,
    publicAccessKey: currentEnv.CLOVER_PUBLIC_ACCESS_KEY ?? null,
    privateToken: (currentEnv.CLOVER_ECOMMERCE_PRIVATE_TOKEN ?? currentEnv.CLOVER_PRIVATE_TOKEN)!,
    platformToken: (currentEnv.CLOVER_PLATFORM_TOKEN ?? currentEnv.CLOVER_PRIVATE_TOKEN)!,
    webhookSecret: currentEnv.CLOVER_WEBHOOK_SECRET ?? null,
    apiBaseUrl:
      currentEnv.CLOVER_API_BASE_URL ??
      (cloverEnv === "sandbox"
        ? "https://apisandbox.dev.clover.com"
        : "https://api.clover.com"),
    ecommerceApiBaseUrl:
      cloverEnv === "sandbox"
        ? "https://scl-sandbox.dev.clover.com"
        : "https://scl.clover.com",
  };
}

export function getCloverCheckoutMode(
  source: NodeJS.ProcessEnv = process.env,
): "hosted" | "iframe" {
  return getEnv(source).CLOVER_CHECKOUT_MODE;
}

export function getCloverPlatformWebhookAuth(
  source: NodeJS.ProcessEnv = process.env,
): string | null {
  return getEnv(source).CLOVER_PLATFORM_WEBHOOK_AUTH ?? null;
}

export function getSmsConfig(
  source: NodeJS.ProcessEnv = process.env,
): { accountSid: string; authToken: string; from: string } | null {
  const currentEnv = getEnv(source);
  const accountSid = currentEnv.TWILIO_ACCOUNT_SID;
  const authToken = currentEnv.TWILIO_AUTH_TOKEN;
  const from = currentEnv.TWILIO_FROM_NUMBER;

  if (!accountSid && !authToken && !from) {
    return null;
  }

  const missingKeys = [
    !accountSid ? "TWILIO_ACCOUNT_SID" : null,
    !authToken ? "TWILIO_AUTH_TOKEN" : null,
    !from ? "TWILIO_FROM_NUMBER" : null,
  ].filter(Boolean);

  if (missingKeys.length > 0) {
    throw new Error(
      `Twilio SMS must be fully configured or fully disabled. Missing: ${missingKeys.join(", ")}.`,
    );
  }

  return { accountSid: accountSid!, authToken: authToken!, from: from! };
}
