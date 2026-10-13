import "server-only";

import { RefundIntentStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type ProviderReconciliationRow = {
  providerPaymentId: string;
  providerOrderId?: string | null;
  amountCents: number;
  refundedAmountCents: number;
  tipCents: number;
  taxCents: number;
  deliveryFeeCents: number;
  currency: string;
};

export type LocalReconciliationRow = ProviderReconciliationRow & {
  orderId: string;
  orderNumber: string;
  tipCents: number;
  taxCents: number;
  deliveryFeeCents: number;
  paymentStatus: string;
  refundStatus: string;
  hasUnknownRefund: boolean;
};

export const RECONCILIATION_TIMEZONE = "America/Toronto";

function nextCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 1));
  return next.toISOString().slice(0, 10);
}

function timezoneOffsetMilliseconds(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  return representedAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function localMidnight(date: string, timezone: string) {
  const target = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== date) throw new Error("Invalid service date.");
  let result = new Date(target - timezoneOffsetMilliseconds(new Date(target + 12 * 60 * 60_000), timezone));
  result = new Date(target - timezoneOffsetMilliseconds(result, timezone));
  return result;
}

export function reconciliationDayRange(date: string, timezone = RECONCILIATION_TIMEZONE) {
  return { start: localMidnight(date, timezone), end: localMidnight(nextCalendarDate(date), timezone), timezone };
}

export function compareReconciliation(local: LocalReconciliationRow[], provider: ProviderReconciliationRow[]) {
  const providerCounts = new Map<string, number>();
  for (const row of provider) providerCounts.set(row.providerPaymentId, (providerCounts.get(row.providerPaymentId) ?? 0) + 1);
  const duplicateProviderPaymentIds = [...providerCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id).sort();
  const providerByPayment = new Map(provider.map((row) => [row.providerPaymentId, row]));
  const localIds = new Set(local.map((row) => row.providerPaymentId));
  const rows = local.map((row) => {
    const match = providerByPayment.get(row.providerPaymentId);
    const reasons: string[] = [];
    if (!match) reasons.push("MISSING_PROVIDER_PAYMENT");
    if ((providerCounts.get(row.providerPaymentId) ?? 0) > 1) reasons.push("DUPLICATE_PROVIDER_PAYMENT");
    if (match && match.amountCents !== row.amountCents) reasons.push("AMOUNT_MISMATCH");
    if (match && match.refundedAmountCents !== row.refundedAmountCents) reasons.push("REFUND_MISMATCH");
    if (match && match.tipCents !== row.tipCents) reasons.push("TIP_MISMATCH");
    if (match && match.taxCents !== row.taxCents) reasons.push("TAX_MISMATCH");
    if (match && match.deliveryFeeCents !== row.deliveryFeeCents) reasons.push("DELIVERY_FEE_MISMATCH");
    if (match && match.currency.toUpperCase() !== row.currency.toUpperCase()) reasons.push("CURRENCY_MISMATCH");
    if (match && row.providerOrderId && match.providerOrderId !== row.providerOrderId) reasons.push("ORDER_ID_MISMATCH");
    if (row.hasUnknownRefund) reasons.push("REFUND_UNKNOWN");
    return { ...row, provider: match ?? null, matched: reasons.length === 0, reasons };
  });
  const providerOnly = provider.filter((row) => !localIds.has(row.providerPaymentId)).map((row) => ({ provider: row, reasons: [...((providerCounts.get(row.providerPaymentId) ?? 0) > 1 ? ["DUPLICATE_PROVIDER_PAYMENT"] : []), "MISSING_LOCAL_PAYMENT"] }));
  return {
    rows,
    providerOnly,
    duplicateProviderPaymentIds,
    summary: {
      localCount: local.length,
      providerCount: provider.length,
      exceptionCount: rows.filter((row) => !row.matched).length + providerOnly.length,
      localAmountCents: local.reduce((sum, row) => sum + row.amountCents, 0),
      providerAmountCents: provider.reduce((sum, row) => sum + row.amountCents, 0),
      localRefundedCents: local.reduce((sum, row) => sum + row.refundedAmountCents, 0),
      providerRefundedCents: provider.reduce((sum, row) => sum + row.refundedAmountCents, 0),
      localTipCents: local.reduce((sum, row) => sum + row.tipCents, 0),
      providerTipCents: provider.reduce((sum, row) => sum + row.tipCents, 0),
      localTaxCents: local.reduce((sum, row) => sum + row.taxCents, 0),
      providerTaxCents: provider.reduce((sum, row) => sum + row.taxCents, 0),
      localDeliveryFeeCents: local.reduce((sum, row) => sum + row.deliveryFeeCents, 0),
      providerDeliveryFeeCents: provider.reduce((sum, row) => sum + row.deliveryFeeCents, 0),
    },
  };
}

export async function getLocalReconciliationRows(start: Date, end: Date): Promise<LocalReconciliationRow[]> {
  const payments = await db.payment.findMany({
    where: { paidAt: { gte: start, lt: end }, providerPaymentId: { not: null } },
    include: { order: { include: { refundIntents: { where: { status: { in: [RefundIntentStatus.UNKNOWN, RefundIntentStatus.REQUIRES_REVIEW] } }, select: { id: true } } } } },
    orderBy: { paidAt: "asc" },
  });
  return payments.map((payment) => ({
    orderId: payment.orderId, orderNumber: payment.order.orderNumber,
    providerPaymentId: payment.providerPaymentId!, providerOrderId: payment.providerOrderId,
    amountCents: payment.amountCents, refundedAmountCents: payment.refundedAmountCents, currency: payment.currency,
    tipCents: payment.order.tipCents, taxCents: payment.order.taxCents, deliveryFeeCents: payment.order.deliveryFeeCents,
    paymentStatus: payment.status, refundStatus: payment.refundStatus, hasUnknownRefund: payment.order.refundIntents.length > 0,
  }));
}
