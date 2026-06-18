import "server-only";

import { type Payment } from "@prisma/client";

import {
  CloverApiError,
  createCloverClient,
  type CloverClient,
} from "@/lib/clover/client";

export type CloverRefundState = "succeeded" | "partial" | "pending" | "failed";

export type CloverRefundResult = {
  state: CloverRefundState;
  providerOperation: "void" | "refund";
  succeeded: boolean;
  partial: boolean;
  pending: boolean;
  failed: boolean;
  providerRefundId: string | null;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  idempotencyKey: string;
  amountCents: number;
  rawResponse: unknown;
};

type CloverRefundResponse = {
  id?: string;
  refundId?: string;
  status?: string;
  state?: string;
  amount?: number;
  payment?: { id?: string };
  charge?: string;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function statusFromResponse(response: unknown): CloverRefundState {
  if (!isRecord(response)) {
    return "pending";
  }

  const rawStatus =
    typeof response.status === "string"
      ? response.status
      : typeof response.state === "string"
        ? response.state
        : null;
  const status = rawStatus?.trim().toUpperCase();

  if (
    status &&
    ["SUCCEEDED", "SUCCESS", "SUCCESSFUL", "RETURNED", "REFUNDED", "VOIDED"].includes(
      status,
    )
  ) {
    return "succeeded";
  }

  if (status && ["PARTIAL", "PARTIALLY_REFUNDED", "PARTIALLY_RETURNED"].includes(status)) {
    return "partial";
  }

  if (status && ["FAILED", "FAILURE", "DECLINED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) {
    return "failed";
  }

  return "pending";
}

function normalizeRefundResult({
  response,
  payment,
  amountCents,
  idempotencyKey,
  providerOperation,
}: {
  response: CloverRefundResponse;
  payment: Payment;
  amountCents: number;
  idempotencyKey: string;
  providerOperation: "void" | "refund";
}): CloverRefundResult {
  const state = statusFromResponse(response);
  const providerRefundId =
    typeof response.id === "string"
      ? response.id
      : typeof response.refundId === "string"
        ? response.refundId
        : null;

  return {
    state,
    providerOperation,
    succeeded: state === "succeeded",
    partial: state === "partial",
    pending: state === "pending",
    failed: state === "failed",
    providerRefundId,
    providerPaymentId: payment.providerPaymentId,
    providerOrderId: payment.providerOrderId,
    idempotencyKey,
    amountCents,
    rawResponse: response,
  };
}

function failedRefundResult({
  error,
  payment,
  amountCents,
  idempotencyKey,
  providerOperation,
}: {
  error: unknown;
  payment: Payment;
  amountCents: number;
  idempotencyKey: string;
  providerOperation: "void" | "refund";
}): CloverRefundResult {
  return {
    state: "failed",
    providerOperation,
    succeeded: false,
    partial: false,
    pending: false,
    failed: true,
    providerRefundId: null,
    providerPaymentId: payment.providerPaymentId,
    providerOrderId: payment.providerOrderId,
    idempotencyKey,
    amountCents,
    rawResponse:
      error instanceof CloverApiError
        ? {
            status: error.status,
            responseBody: error.responseBody,
            message: error.message,
          }
        : {
            message: error instanceof Error ? error.message : "Unknown Clover refund error.",
          },
  };
}

function buildIdempotencyKey(payment: Payment, amountCents: number): string {
  return `refund:${payment.id}:${amountCents}`;
}

function canAttemptVoid(payment: Payment, amountCents: number): boolean {
  if (!payment.providerPaymentId || amountCents !== payment.amountCents) {
    return false;
  }

  if (!payment.paidAt) {
    return false;
  }

  const ageMs = Date.now() - payment.paidAt.getTime();
  return ageMs >= 0 && ageMs <= 25 * 60 * 1000;
}

export async function refundCloverPayment({
  payment,
  amountCents,
  client = createCloverClient(),
  idempotencyKey = buildIdempotencyKey(payment, amountCents),
}: {
  payment: Payment;
  amountCents: number;
  client?: CloverClient;
  idempotencyKey?: string;
}): Promise<CloverRefundResult> {
  if (amountCents <= 0) {
    throw new Error("Refund amount must be greater than zero.");
  }

  const headers = { "Idempotency-Key": idempotencyKey };
  let providerOperation: "void" | "refund" = "refund";

  try {
    if (canAttemptVoid(payment, amountCents)) {
      providerOperation = "void";
      const response = await client.post<CloverRefundResponse>(
        `/v1/payments/${encodeURIComponent(payment.providerPaymentId!)}/void`,
        { voidReason: "USER_CANCEL" },
        { headers },
      );

      return normalizeRefundResult({
        response,
        payment,
        amountCents,
        idempotencyKey,
        providerOperation: "void",
      });
    }

    if (payment.providerOrderId) {
      const response = await client.post<CloverRefundResponse>(
        `/v1/orders/${encodeURIComponent(payment.providerOrderId)}/returns`,
        {},
        { headers },
      );

      return normalizeRefundResult({
        response,
        payment,
        amountCents,
        idempotencyKey,
        providerOperation: "refund",
      });
    }

    if (!payment.providerPaymentId) {
      throw new Error("Clover payment id is missing.");
    }

    const response = await client.post<CloverRefundResponse>(
      "/v1/refunds",
      { charge: payment.providerPaymentId, amount: amountCents },
      { headers },
    );

    return normalizeRefundResult({
      response,
      payment,
      amountCents,
      idempotencyKey,
      providerOperation: "refund",
    });
  } catch (error) {
    return failedRefundResult({
      error,
      payment,
      amountCents,
      idempotencyKey,
      providerOperation,
    });
  }
}
