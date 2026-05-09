import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().optional(),
  ADMIN_EMAILS: z.string().optional(),
  CRON_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_FROM_NUMBER: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}

export function getAdminEmails(source: NodeJS.ProcessEnv = process.env): string[] {
  return (source.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export function getAppUrl(source: NodeJS.ProcessEnv = process.env): string {
  return source.APP_URL ?? "http://localhost:3000";
}

export function getCronSecret(source: NodeJS.ProcessEnv = process.env): string | null {
  return source.CRON_SECRET?.trim() || null;
}

export function getSmsConfig(source: NodeJS.ProcessEnv = process.env) {
  const accountSid = source.TWILIO_ACCOUNT_SID?.trim();
  const authToken = source.TWILIO_AUTH_TOKEN?.trim();
  const from = source.TWILIO_FROM_NUMBER?.trim();

  if (!accountSid || !authToken || !from) {
    return null;
  }

  return { accountSid, authToken, from };
}
