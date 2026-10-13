import Link from "next/link";
import { CheckCircle2, CircleAlert, Download } from "lucide-react";

import {
  AdminPage,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-page-ui";
import type { FinancialPeriod } from "@/lib/reports/financial";

type Summary = {
  period: FinancialPeriod;
  orderCount: number;
  completedOrders: number;
  salesCents: number;
  refundedCents: number;
  taxCents: number;
  tipCents: number;
  deliveryFeeCents: number;
  unresolved: number;
  comparedDays: number;
  cloverCount: number;
  cloverAmountCents: number;
  comparisonAvailable: boolean;
  comparisonComplete: boolean;
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    cents / 100,
  );

export default function FinancialSummary({
  summary,
  title,
  mode,
}: {
  summary: Summary;
  title: string;
  mode: "daily" | "monthly";
}) {
  const difference = summary.salesCents - summary.cloverAmountCents;
  const matches =
    summary.comparisonComplete && summary.unresolved === 0 && difference === 0;
  return (
    <AdminPage>
      <AdminPageHeader title={title} description="Does the money match?" />
      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        method="get"
      >
        <label className="grid gap-2 text-sm font-semibold text-[#062F24]">
          {mode === "daily" ? "Choose a day" : "Choose a month"}
          <input
            type={mode === "daily" ? "date" : "month"}
            name={mode === "daily" ? "date" : "month"}
            defaultValue={summary.period.key}
            className="min-h-11 rounded-button border border-[#062F24]/15 px-3"
          />
        </label>
        <button
          className="min-h-11 rounded-button bg-[#062F24] px-5 text-sm font-semibold text-white"
          type="submit"
        >
          Show report
        </button>
      </form>
      <AdminPanel
        className={`mt-8 ${matches ? "border-emerald-800/20 bg-emerald-50/50" : "border-amber-800/20 bg-amber-50/50"}`}
      >
        <div className="flex items-start gap-4">
          {matches ? (
            <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-800" />
          ) : (
            <CircleAlert className="h-7 w-7 shrink-0 text-amber-800" />
          )}
          <div>
            <h2 className="text-2xl font-extrabold text-[#062F24]">
              {matches
                ? mode === "daily"
                  ? "Today’s money matches"
                  : "This month’s money matches"
                : summary.comparisonComplete
                  ? `${summary.unresolved || 1} financial record${summary.unresolved === 1 ? "" : "s"} need review`
                  : "Clover comparison is waiting"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#062F24]/65">
              {matches
                ? "Buffet Pin and the latest Clover closing information agree."
                : summary.comparisonComplete
                  ? "The business totals remain visible below. Technical support can investigate the detailed difference."
                  : summary.comparisonAvailable
                    ? "Some Clover closing evidence is available, but the full period has not been compared yet."
                    : "Buffet Pin totals are ready. Technical support has not yet supplied Clover closing evidence for this period."}
            </p>
          </div>
        </div>
      </AdminPanel>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Sales", money(summary.salesCents)],
          ["Completed orders", String(summary.completedOrders)],
          ["Taxes collected", money(summary.taxCents)],
          ["Refunded", money(summary.refundedCents)],
          ["Tips", money(summary.tipCents)],
          ["Delivery fees", money(summary.deliveryFeeCents)],
          ["Buffet Pin orders", String(summary.orderCount)],
          ["Unresolved records", String(summary.unresolved)],
        ].map(([label, value]) => (
          <AdminPanel key={label}>
            <p className="text-sm font-semibold text-[#062F24]/60">{label}</p>
            <p className="mt-3 text-2xl font-extrabold text-[#062F24]">
              {value}
            </p>
          </AdminPanel>
        ))}
      </div>
      {summary.comparisonAvailable ? (
        <AdminPanel className="mt-6">
          <h2 className="text-lg font-extrabold text-[#062F24]">
            Buffet Pin and Clover
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <p>
              <span className="block text-sm text-[#062F24]/60">
                Buffet Pin total
              </span>
              <strong className="text-xl">{money(summary.salesCents)}</strong>
            </p>
            <p>
              <span className="block text-sm text-[#062F24]/60">
                Clover total
                {summary.comparisonComplete ? "" : " (compared days only)"}
              </span>
              <strong className="text-xl">
                {money(summary.cloverAmountCents)}
              </strong>
            </p>
            <p>
              <span className="block text-sm text-[#062F24]/60">
                Difference
              </span>
              <strong className="text-xl">{money(difference)}</strong>
            </p>
          </div>
        </AdminPanel>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/api/reports/export?kind=${mode}&period=${summary.period.key}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-button border border-[#062F24]/15 px-4 text-sm font-semibold text-[#062F24]"
        >
          <Download size={15} /> Download CSV
        </Link>
        <Link
          href="/reports/orders"
          className="inline-flex min-h-11 items-center rounded-button px-4 text-sm font-semibold text-[#062F24] underline"
        >
          View order records
        </Link>
      </div>
    </AdminPage>
  );
}
