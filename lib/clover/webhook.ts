import "server-only";

import { createHmac, createHash, timingSafeEqual } from "crypto";

import {
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  Prisma,
  type Payment,
} from "@prisma/client";

const SIGNATURE_HEADER = "clover-signature";
const SIGNATURE_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export type CloverWebhookParseResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; code: "INVALID_JSON" | "INVALID_PAYLOAD"; message: string };

export type CloverWebhookSignatureResult =
  | { ok: true }
  | { ok: false; code: "MISSING_SECRET" | "MISSING_SIGNATURE" | "INVALID_SIGNATURE"; message: string };

export type CloverPaymentWebhook = {
  providerEventId: string;
  eventType: string;
  checkoutSessionId: string | null;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  localPaymentId: string | null;
  localOrderId: string | null;
  localOrderPublicCode: string | null;
  paymentStatus: OrderPaymentStatus | null;
  paidAt: Date | null;
  failedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getPath(payload: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = payload;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function getFirstString(payload: Record<string, unknown>, paths: string[][]): string | null {
  for (const path of paths) {
    const value = asNonEmptyString(getPath(payload, path));

    if (value) {
      return value;
    }
  }

  return null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function parseSignatureHeader(header: string | null): { timestamp: string; signatures: string[] } | null {
  if (!header) {
    return null;
  }

  const values = header.split(",").map((part) => part.trim());
  const timestamp = values
    .map((part) => part.match(/^t=(.+)$/)?.[1])
    .find((value): value is string => Boolean(value));
  const signatures = values
    .map((part) => part.match(/^v1=(.+)$/)?.[1])
    .filter((value): value is string => Boolean(value));

  if (!timestamp || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

function safeEqualHex(leftHex: string, rightHex: string): boolean {
  if (!/^[a-f0-9]+$/i.test(leftHex) || !/^[a-f0-9]+$/i.test(rightHex)) {
    return false;
  }

  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");

  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyCloverWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
  now = new Date(),
}: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string | null | undefined;
  now?: Date;
}): CloverWebhookSignatureResult {
  if (!secret) {
    return {
      ok: false,
      code: "MISSING_SECRET",
      message: "Clover webhook signing secret is not configured.",
    };
  }

  const parsedHeader = parseSignatureHeader(signatureHeader);

  if (!parsedHeader) {
    return {
      ok: false,
      code: "MISSING_SIGNATURE",
      message: "Missing or invalid Clover signature header.",
    };
  }

  const timestampSeconds = asFiniteNumber(parsedHeader.timestamp);

  if (!timestampSeconds) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      message: "Invalid Clover signature timestamp.",
    };
  }

  const ageSeconds = Math.abs(Math.floor(now.getTime() / 1000) - timestampSeconds);

  if (ageSeconds > SIGNATURE_TIMESTAMP_TOLERANCE_SECONDS) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      message: "Expired Clover signature timestamp.",
    };
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsedHeader.timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  if (!parsedHeader.signatures.some((signature) => safeEqualHex(expected, signature))) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      message: "Invalid Clover signature.",
    };
  }

  return { ok: true };
}

export function getCloverSignatureHeader(headers: Headers): string | null {
  return headers.get(SIGNATURE_HEADER);
}

export function parseCloverWebhookPayload(rawBody: string): CloverWebhookParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Invalid Clover webhook JSON.",
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Clover webhook payload must be a JSON object.",
    };
  }

  return { ok: true, payload: parsed };
}

function derivePaymentStatus(payload: Record<string, unknown>): OrderPaymentStatus | null {
  const status = getFirstString(payload, [
    ["status"],
    ["Status"],
    ["payment", "status"],
    ["data", "status"],
    ["Data", "status"],
  ])?.toUpperCase();
  const message = getFirstString(payload, [["message"], ["Message"]])?.toUpperCase() ?? "";

  if (
    status &&
    ["APPROVED", "PAID", "SUCCESS", "SUCCEEDED", "CAPTURED", "COMPLETED"].includes(status)
  ) {
    return OrderPaymentStatus.PAID;
  }

  if (message.startsWith("APPROVED")) {
    return OrderPaymentStatus.PAID;
  }

  if (
    status &&
    ["DECLINED", "FAILED", "FAILURE", "CANCELED", "CANCELLED", "EXPIRED", "VOIDED"].includes(status)
  ) {
    return OrderPaymentStatus.FAILED;
  }

  if (message.startsWith("DECLINE") || message.startsWith("DECLINED")) {
    return OrderPaymentStatus.FAILED;
  }

  return null;
}

function deriveEventTimestamp(payload: Record<string, unknown>): Date | null {
  const value =
    getPath(payload, ["createdTime"]) ??
    getPath(payload, ["created_time"]) ??
    getPath(payload, ["CreatedTime"]) ??
    getPath(payload, ["Created Time"]);
  const timestamp = asFiniteNumber(value);

  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveProviderEventId(payload: Record<string, unknown>): string {
  const stableEventId = getFirstString(payload, [
    ["eventId"],
    ["event_id"],
    ["webhookId"],
    ["webhook_id"],
    ["notificationId"],
    ["notification_id"],
  ]);

  if (stableEventId) {
    return stableEventId;
  }

  const providerFields = {
    createdTime: getPath(payload, ["createdTime"]) ?? getPath(payload, ["created_time"]) ?? null,
    data: getPath(payload, ["data"]) ?? getPath(payload, ["Data"]) ?? null,
    id:
      getPath(payload, ["id"]) ??
      getPath(payload, ["Id"]) ??
      getPath(payload, ["payment", "id"]) ??
      null,
    merchantId:
      getPath(payload, ["merchantId"]) ??
      getPath(payload, ["merchant_id"]) ??
      getPath(payload, ["MerchantId"]) ??
      null,
    status: getPath(payload, ["status"]) ?? getPath(payload, ["Status"]) ?? null,
    type: getPath(payload, ["type"]) ?? getPath(payload, ["Type"]) ?? null,
  };

  return `computed:${createHash("sha256").update(stableJson(providerFields)).digest("hex")}`;
}

export function normalizeCloverWebhook(payload: Record<string, unknown>): CloverPaymentWebhook {
  const eventType =
    getFirstString(payload, [["type"], ["Type"], ["eventType"], ["event_type"]]) ??
    "UNKNOWN";
  const checkoutSessionId = getFirstString(payload, [
    ["checkoutSessionId"],
    ["checkout_session_id"],
    ["checkout", "sessionId"],
    ["checkout", "checkoutSessionId"],
    ["payment", "checkoutSessionId"],
    ["data", "checkoutSessionId"],
    ["Data", "checkoutSessionId"],
    ["data"],
    ["Data"],
  ]);
  const providerPaymentId = getFirstString(payload, [
    ["payment", "id"],
    ["paymentId"],
    ["payment_id"],
    ["providerPaymentId"],
    ["provider_payment_id"],
    ["id"],
    ["Id"],
  ]);
  const providerOrderId = getFirstString(payload, [
    ["payment", "order", "id"],
    ["payment", "orderId"],
    ["payment", "order_id"],
    ["order", "id"],
    ["orderId"],
    ["order_id"],
    ["providerOrderId"],
    ["provider_order_id"],
    ["data", "payment", "order", "id"],
    ["data", "order", "id"],
    ["data", "orderId"],
  ]);
  const localPaymentId = getFirstString(payload, [
    ["metadata", "localPaymentId"],
    ["metadata", "paymentId"],
    ["metadata", "buffetPinPaymentId"],
    ["data", "metadata", "localPaymentId"],
    ["data", "metadata", "paymentId"],
  ]);
  const localOrderId = getFirstString(payload, [
    ["metadata", "localOrderId"],
    ["metadata", "orderId"],
    ["metadata", "buffetPinOrderId"],
    ["data", "metadata", "localOrderId"],
    ["data", "metadata", "orderId"],
  ]);
  const localOrderPublicCode = getFirstString(payload, [
    ["metadata", "publicCode"],
    ["metadata", "orderPublicCode"],
    ["data", "metadata", "publicCode"],
    ["data", "metadata", "orderPublicCode"],
  ]);
  const paymentStatus = derivePaymentStatus(payload);
  const eventTimestamp = deriveEventTimestamp(payload);
  const failureCode = getFirstString(payload, [
    ["failureCode"],
    ["failure_code"],
    ["reason"],
    ["data", "failureCode"],
  ]);
  const failureMessage = getFirstString(payload, [
    ["failureMessage"],
    ["failure_message"],
    ["message"],
    ["data", "failureMessage"],
  ]);

  return {
    providerEventId: deriveProviderEventId(payload),
    eventType,
    checkoutSessionId,
    providerPaymentId,
    providerOrderId,
    localPaymentId,
    localOrderId,
    localOrderPublicCode,
    paymentStatus,
    paidAt: paymentStatus === OrderPaymentStatus.PAID ? eventTimestamp ?? new Date() : null,
    failedAt: paymentStatus === OrderPaymentStatus.FAILED ? eventTimestamp ?? new Date() : null,
    failureCode: paymentStatus === OrderPaymentStatus.FAILED ? failureCode : null,
    failureMessage: paymentStatus === OrderPaymentStatus.FAILED ? failureMessage : null,
    payload,
  };
}

export function nextPaymentStatus(
  currentStatus: OrderPaymentStatus,
  webhookStatus: OrderPaymentStatus | null,
): OrderPaymentStatus {
  if (!webhookStatus) {
    return currentStatus;
  }

  if (webhookStatus === OrderPaymentStatus.PAID) {
    return OrderPaymentStatus.PAID;
  }

  if (
    webhookStatus === OrderPaymentStatus.FAILED &&
    currentStatus !== OrderPaymentStatus.PAID &&
    currentStatus !== OrderPaymentStatus.REFUNDED &&
    currentStatus !== OrderPaymentStatus.PARTIALLY_REFUNDED
  ) {
    return OrderPaymentStatus.FAILED;
  }

  return currentStatus;
}

export function nextFulfillmentStatus({
  paymentStatus,
  fulfillmentStatus,
}: {
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
}): OrderFulfillmentStatus {
  if (
    paymentStatus === OrderPaymentStatus.PAID &&
    fulfillmentStatus === OrderFulfillmentStatus.AWAITING_PAYMENT
  ) {
    return OrderFulfillmentStatus.AWAITING_ACCEPTANCE;
  }

  return fulfillmentStatus;
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function buildRawProviderData(
  payment: Payment,
  webhook: CloverPaymentWebhook,
): Prisma.InputJsonValue {
  return toPrismaJson({
    previous: payment.rawProviderData ?? null,
    latestWebhook: {
      providerEventId: webhook.providerEventId,
      eventType: webhook.eventType,
      checkoutSessionId: webhook.checkoutSessionId,
      providerPaymentId: webhook.providerPaymentId,
      providerOrderId: webhook.providerOrderId,
      payload: webhook.payload,
    },
  });
}
