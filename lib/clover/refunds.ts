import "server-only";

import type { Payment } from "@prisma/client";
import { getCloverConfig, type CloverConfig } from "@/lib/env";

export type CloverRefundState = "succeeded" | "unknown" | "failed";
export type CloverRefundResult = {
  state: CloverRefundState;
  providerOperation: "refund";
  succeeded: boolean;
  partial: boolean;
  pending: boolean;
  unknown: boolean;
  failed: boolean;
  providerRefundId: string | null;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  idempotencyKey: string;
  amountCents: number;
  errorCode: string | null;
  rawResponse: unknown;
};

type Fetcher = typeof fetch;
type RefundResponse = { id?: string; amount?: number; charge?: string; status?: string; [key: string]: unknown };

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return { message: text.slice(0, 500) }; }
}

function result(input: {
  state: CloverRefundState;
  payment: Payment;
  amountCents: number;
  idempotencyKey: string;
  response: unknown;
  providerRefundId?: string | null;
  errorCode?: string | null;
}): CloverRefundResult {
  return {
    state: input.state,
    providerOperation: "refund",
    succeeded: input.state === "succeeded",
    partial: false,
    pending: input.state === "unknown",
    unknown: input.state === "unknown",
    failed: input.state === "failed",
    providerRefundId: input.providerRefundId ?? null,
    providerPaymentId: input.payment.providerPaymentId,
    providerOrderId: input.payment.providerOrderId,
    idempotencyKey: input.idempotencyKey,
    amountCents: input.amountCents,
    errorCode: input.errorCode ?? null,
    rawResponse: input.response,
  };
}

/**
 * Clover documents Ecommerce refunds as POST /v1/refunds against the original
 * charge. Card-present void is a device endpoint and is intentionally not used.
 */
export async function refundCloverPayment({
  payment,
  amountCents,
  idempotencyKey,
  config,
  fetcher = fetch,
}: {
  payment: Payment;
  amountCents: number;
  idempotencyKey: string;
  config?: CloverConfig;
  fetcher?: Fetcher;
}): Promise<CloverRefundResult> {
  if (amountCents <= 0) throw new Error("Refund amount must be greater than zero.");
  if (!payment.providerPaymentId) throw new Error("Clover charge id is missing.");

  const payload = {
    charge: payment.providerPaymentId,
    amount: amountCents,
    reason: "requested_by_customer",
    external_reference_id: idempotencyKey.slice(-12).replace(/[^a-zA-Z0-9]/g, "0"),
  };

  try {
    const resolvedConfig = config ?? getCloverConfig();
    const response = await fetcher(`${resolvedConfig.ecommerceApiBaseUrl.replace(/\/$/, "")}/v1/refunds`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${resolvedConfig.privateToken}`,
        "content-type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "User-Agent": "buffet-pin-direct/1.0",
      },
      body: JSON.stringify(payload),
    });
    const body = await responseBody(response);

    if (!response.ok) {
      const ambiguous = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      return result({
        state: ambiguous ? "unknown" : "failed",
        payment,
        amountCents,
        idempotencyKey,
        response: { status: response.status, body },
        errorCode: `HTTP_${response.status}`,
      });
    }

    const parsed = body as RefundResponse | null;
    if (!parsed?.id) {
      return result({ state: "unknown", payment, amountCents, idempotencyKey, response: body, errorCode: "MISSING_REFUND_ID" });
    }
    if (typeof parsed.amount === "number" && parsed.amount !== amountCents) {
      return result({ state: "unknown", payment, amountCents, idempotencyKey, response: body, providerRefundId: parsed.id, errorCode: "AMOUNT_MISMATCH" });
    }
    return result({ state: "succeeded", payment, amountCents, idempotencyKey, response: body, providerRefundId: parsed.id });
  } catch (error) {
    return result({
      state: "unknown",
      payment,
      amountCents,
      idempotencyKey,
      response: { message: error instanceof Error ? error.message : String(error) },
      errorCode: "TRANSPORT_UNKNOWN",
    });
  }
}
