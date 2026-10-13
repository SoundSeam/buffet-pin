import "server-only";

import { getEnv } from "@/lib/env";

export type EmailSendResult =
  | { ok: true; id: string; status: "queued" }
  | { ok: false; skipped?: boolean; error: unknown };

export async function sendEmail(
  recipient: string,
  subject: string,
  body: string,
  idempotencyKey = crypto.randomUUID(),
): Promise<EmailSendResult> {
  const env = getEnv();
  if (env.PROVIDER_MODE === "fake")
    return {
      ok: true,
      id: `fake-email-${crypto.randomUUID()}`,
      status: "queued",
    };
  if (env.ORDER_EMAIL_PROVIDER === "disabled")
    return {
      ok: false,
      skipped: true,
      error: new Error("Order email provider is disabled."),
    };
  if (!env.RESEND_API_KEY || !env.ORDER_EMAIL_FROM)
    return {
      ok: false,
      error: new Error("Resend order email configuration is incomplete."),
    };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
        "idempotency-key": `buffet-pin-${idempotencyKey}`,
      },
      body: JSON.stringify({
        from: env.ORDER_EMAIL_FROM,
        to: [recipient],
        subject,
        text: body,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null;
    if (!response.ok || !payload?.id)
      return {
        ok: false,
        error: {
          status: response.status,
          message: payload?.message ?? "Email provider rejected the message.",
        },
      };
    return { ok: true, id: payload.id, status: "queued" };
  } catch (error) {
    return { ok: false, error };
  }
}
