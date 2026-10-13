import "server-only";

import { randomUUID } from "crypto";

import { type Order, type Payment } from "@prisma/client";

import { getCloverConfig, type CloverConfig } from "@/lib/env";

export class CloverEcommerceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloverEcommerceConfigError";
  }
}

export class CloverEcommerceChargeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: unknown,
  ) {
    super(message);
    this.name = "CloverEcommerceChargeError";
  }
}

export type CloverChargeRequest = {
  amount: number;
  tip_amount: number;
  currency: string;
  source: string;
  ecomind: "ecom";
  metadata: {
    localOrderId: string;
    localPaymentId: string;
    orderNumber: string;
    idempotencyKey: string;
  };
};

export type CloverChargeResponse = {
  id?: string;
  status?: string;
  paid?: boolean;
  captured?: boolean;
  amount?: number;
  amount_paid?: number;
  currency?: string;
  charge?: string;
  order?: string | { id?: string };
  source?: { id?: string; brand?: string; last4?: string; exp_month?: number; exp_year?: number };
  outcome?: { type?: string; network_status?: string };
  [key: string]: unknown;
};

export type CloverChargeResult = {
  providerPaymentId: string;
  providerOrderId: string | null;
  status: "paid" | "failed" | "pending";
  paid: boolean;
  failed: boolean;
  idempotencyKey: string;
  requestPayload: CloverChargeRequest;
  rawProviderData: CloverChargeResponse;
};

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toLowerCase();
}

function getProviderOrderId(response: CloverChargeResponse): string | null {
  if (typeof response.order === "string" && response.order.trim()) {
    return response.order;
  }

  if (
    typeof response.order === "object" &&
    response.order !== null &&
    typeof response.order.id === "string" &&
    response.order.id.trim()
  ) {
    return response.order.id;
  }

  return null;
}

function normalizeChargeStatus(response: CloverChargeResponse): "paid" | "failed" | "pending" {
  const status = typeof response.status === "string" ? response.status.toUpperCase() : "";

  if (
    ["SUCCEEDED", "SUCCESS", "PAID", "CAPTURED"].includes(status) &&
    response.paid !== false &&
    response.captured !== false
  ) {
    return "paid";
  }

  if (["FAILED", "FAILURE", "DECLINED", "CANCELED", "CANCELLED"].includes(status)) {
    return "failed";
  }

  return "pending";
}

function buildChargeRequest({
  order,
  payment,
  source,
  idempotencyKey,
}: {
  order: Order;
  payment: Payment;
  source: string;
  idempotencyKey: string;
}): CloverChargeRequest {
  if (payment.amountCents !== order.totalCents) {
    throw new Error(
      `Payment amount mismatch for order ${order.id}: expected ${order.totalCents}, got ${payment.amountCents}.`,
    );
  }

  return {
    amount: payment.amountCents - order.tipCents,
    tip_amount: order.tipCents,
    currency: normalizeCurrency(payment.currency),
    source,
    ecomind: "ecom",
    metadata: {
      localOrderId: order.id,
      localPaymentId: payment.id,
      orderNumber: order.orderNumber,
      idempotencyKey,
    },
  };
}

export async function createCloverEcommerceCharge({
  order,
  payment,
  source,
  idempotencyKey = randomUUID(),
  forwardedFor,
  providerOrderId,
  config = getCloverConfig(),
}: {
  order: Order;
  payment: Payment;
  source: string;
  idempotencyKey?: string;
  forwardedFor?: string | null;
  providerOrderId: string;
  config?: CloverConfig;
}): Promise<CloverChargeResult> {
  if (!source.trim()) {
    throw new CloverEcommerceConfigError("Clover source token is required.");
  }

  const requestPayload = buildChargeRequest({
    order,
    payment,
    source: source.trim(),
    idempotencyKey,
  });
  if (!providerOrderId.trim()) {
    throw new CloverEcommerceConfigError("A reconciled Clover order id is required.");
  }
  const response = await fetch(
    joinUrl(config.ecommerceApiBaseUrl, `/v1/orders/${encodeURIComponent(providerOrderId)}/pay`), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.privateToken}`,
      "content-type": "application/json",
      "Idempotency-Key": idempotencyKey,
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    },
    body: JSON.stringify(requestPayload),
    cache: "no-store",
    },
  );
  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw new CloverEcommerceChargeError(
      `Clover Ecommerce charge failed with status ${response.status}.`,
      response.status,
      responseBody,
    );
  }

  const rawProviderData = responseBody as CloverChargeResponse;
  const providerPaymentId =
    typeof rawProviderData.charge === "string" && rawProviderData.charge.trim()
      ? rawProviderData.charge
      : typeof rawProviderData.id === "string" && rawProviderData.id.trim()
        ? rawProviderData.id
        : null;

  if (!providerPaymentId) {
    throw new CloverEcommerceChargeError(
      "Clover Ecommerce charge response did not include a charge id.",
      502,
      rawProviderData,
    );
  }

  const status = normalizeChargeStatus(rawProviderData);
  const responseOrderId = getProviderOrderId(rawProviderData) ??
    (typeof rawProviderData.id === "string" ? rawProviderData.id : null);
  const responseCurrency = rawProviderData.currency?.toUpperCase();
  if (responseOrderId && responseOrderId !== providerOrderId) {
    throw new CloverEcommerceChargeError("Clover paid a different order than requested.", 502, rawProviderData);
  }
  if (responseCurrency && responseCurrency !== payment.currency.toUpperCase()) {
    throw new CloverEcommerceChargeError("Clover payment currency did not match the local order.", 502, rawProviderData);
  }
  if (
    status === "paid" &&
    rawProviderData.amount_paid !== payment.amountCents
  ) {
    throw new CloverEcommerceChargeError("Clover paid amount did not match the local order.", 502, rawProviderData);
  }

  return {
    providerPaymentId,
    providerOrderId: responseOrderId ?? providerOrderId,
    status,
    paid: status === "paid",
    failed: status === "failed",
    idempotencyKey,
    requestPayload,
    rawProviderData,
  };
}
