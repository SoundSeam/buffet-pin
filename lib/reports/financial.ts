import "server-only";

import { db } from "@/lib/db";
import { reconciliationDayRange } from "@/lib/orders/reconciliation";

export type FinancialPeriod = {
  start: Date;
  end: Date;
  label: string;
  key: string;
};

export function dailyPeriod(date: string): FinancialPeriod {
  const { start, end } = reconciliationDayRange(date);
  return { start, end, label: date, key: date };
}

export function monthlyPeriod(month: string): FinancialPeriod {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month.");
  const startKey = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year!, monthNumber!, 1));
  const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const start = reconciliationDayRange(startKey).start;
  const end = reconciliationDayRange(nextKey).start;
  return { start, end, label: month, key: month };
}

function reportSummary(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const report = value as { summary?: Record<string, unknown> };
  return report.summary ?? null;
}

export async function getFinancialSummary(period: FinancialPeriod) {
  const [payments, completedOrders, imports, unresolved] = await Promise.all([
    db.payment.findMany({
      where: {
        paidAt: { gte: period.start, lt: period.end },
        providerPaymentId: { not: null },
      },
      select: {
        paidAt: true,
        amountCents: true,
        refundedAmountCents: true,
        order: {
          select: { taxCents: true, tipCents: true, deliveryFeeCents: true },
        },
      },
    }),
    db.order.count({
      where: {
        dispatchStatus: "DELIVERED",
        completedAt: { gte: period.start, lt: period.end },
      },
    }),
    db.reconciliationImport.findMany({
      where: {
        serviceDate:
          period.key.length === 7 ? { startsWith: period.key } : period.key,
      },
      orderBy: { createdAt: "desc" },
      select: { serviceDate: true, report: true, createdAt: true },
    }),
    db.reconciliationVariance.count({
      where: {
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        import: {
          serviceDate:
            period.key.length === 7 ? { startsWith: period.key } : period.key,
        },
      },
    }),
  ]);
  const latestByDate = new Map<string, (typeof imports)[number]>();
  for (const entry of imports)
    if (!latestByDate.has(entry.serviceDate))
      latestByDate.set(entry.serviceDate, entry);
  const comparisonSummaries = [...latestByDate.values()]
    .map((entry) => reportSummary(entry.report))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const localServiceDates = new Set(
    payments
      .map((payment) =>
        payment.paidAt
          ? new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Toronto",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(payment.paidAt)
          : null,
      )
      .filter((value): value is string => Boolean(value)),
  );
  const comparisonComplete =
    comparisonSummaries.length > 0 &&
    [...localServiceDates].every((date) => latestByDate.has(date));
  return {
    period,
    orderCount: payments.length,
    completedOrders,
    salesCents: payments.reduce((sum, payment) => sum + payment.amountCents, 0),
    refundedCents: payments.reduce(
      (sum, payment) => sum + payment.refundedAmountCents,
      0,
    ),
    taxCents: payments.reduce(
      (sum, payment) => sum + payment.order.taxCents,
      0,
    ),
    tipCents: payments.reduce(
      (sum, payment) => sum + payment.order.tipCents,
      0,
    ),
    deliveryFeeCents: payments.reduce(
      (sum, payment) => sum + payment.order.deliveryFeeCents,
      0,
    ),
    unresolved,
    comparedDays: latestByDate.size,
    cloverCount: comparisonSummaries.reduce(
      (sum, comparison) => sum + Number(comparison.providerCount ?? 0),
      0,
    ),
    cloverAmountCents: comparisonSummaries.reduce(
      (sum, comparison) => sum + Number(comparison.providerAmountCents ?? 0),
      0,
    ),
    comparisonAvailable: comparisonSummaries.length > 0,
    comparisonComplete,
  };
}

export async function getFinancialOrders(period: FinancialPeriod) {
  return db.payment.findMany({
    where: {
      paidAt: { gte: period.start, lt: period.end },
      providerPaymentId: { not: null },
    },
    orderBy: { paidAt: "desc" },
    take: 500,
    select: {
      id: true,
      paidAt: true,
      amountCents: true,
      refundedAmountCents: true,
      currency: true,
      status: true,
      refundStatus: true,
      providerPaymentId: true,
      order: {
        select: {
          orderNumber: true,
          taxCents: true,
          tipCents: true,
          deliveryFeeCents: true,
          dispatchStatus: true,
        },
      },
    },
  });
}

export async function getFinancialRefunds(period: FinancialPeriod) {
  return db.refundIntent.findMany({
    where: { createdAt: { gte: period.start, lt: period.end } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      createdAt: true,
      amountCents: true,
      currency: true,
      status: true,
      reason: true,
      resolvedAt: true,
      order: { select: { orderNumber: true } },
    },
  });
}
