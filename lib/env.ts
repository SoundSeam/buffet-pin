import "server-only";

import { z } from "zod";

const LOCAL_APP_URL = "http://localhost:3000";

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

const optionalString = z.preprocess(trimToUndefined, z.string().min(1).optional());
const optionalHttpUrl = z.preprocess(
  normalizeHttpUrl,
  z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Must be an absolute http(s) URL.")
    .optional(),
);

const envSchema = z
  .object({
    APP_URL: optionalHttpUrl,
    ADMIN_EMAILS: optionalString,
    CRON_SECRET: optionalString,
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
    TWILIO_ACCOUNT_SID: optionalString,
    TWILIO_AUTH_TOKEN: optionalString,
    TWILIO_FROM_NUMBER: optionalString,
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
  }

  if (!env.CRON_SECRET) {
    errors.push("CRON_SECRET is required in production.");
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

export function getSmsConfig(source: NodeJS.ProcessEnv = process.env) {
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

  return { accountSid, authToken, from };
}
