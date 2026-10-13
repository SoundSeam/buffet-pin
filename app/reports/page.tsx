import Link from "next/link";

import {
  AdminPage,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-page-ui";
import {
  dailyPeriod,
  getFinancialSummary,
  monthlyPeriod,
} from "@/lib/reports/financial";
import { requireStaffUser } from "@/lib/supabase/auth";

const money = (cents: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    cents / 100,
  );
const todayKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export default async function ReportsHome() {
  await requireStaffUser("REPORTING_READ");
  const today = todayKey();
  const month = today.slice(0, 7);
  const [daily, monthly] = await Promise.all([
    getFinancialSummary(dailyPeriod(today)),
    getFinancialSummary(monthlyPeriod(month)),
  ]);
  return (
    <AdminPage>
      <AdminPageHeader
        title="Financial overview"
        description="Does the money match?"
      />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Link
          href={`/reports/daily?date=${today}`}
          className="rounded-surface-lg border border-[#062F24]/10 p-6 shadow-sm transition hover:border-[#062F24]/25"
        >
          <p className="text-sm font-semibold text-[#062F24]/60">
            Today’s sales
          </p>
          <p className="mt-3 text-4xl font-extrabold">
            {money(daily.salesCents)}
          </p>
          <p className="mt-3 text-sm text-[#062F24]/65">
            {daily.orderCount} paid orders · {daily.unresolved} unresolved
            financial records
          </p>
        </Link>
        <Link
          href={`/reports/monthly?month=${month}`}
          className="rounded-surface-lg border border-[#062F24]/10 p-6 shadow-sm transition hover:border-[#062F24]/25"
        >
          <p className="text-sm font-semibold text-[#062F24]/60">
            Current month
          </p>
          <p className="mt-3 text-4xl font-extrabold">
            {money(monthly.salesCents)}
          </p>
          <p className="mt-3 text-sm text-[#062F24]/65">
            Tax {money(monthly.taxCents)} · refunded{" "}
            {money(monthly.refundedCents)}
          </p>
        </Link>
      </div>
      <AdminPanel className="mt-6">
        <h2 className="text-xl font-extrabold">
          {daily.comparisonComplete &&
          daily.unresolved === 0 &&
          daily.salesCents === daily.cloverAmountCents
            ? "Today’s money matches"
            : daily.comparisonAvailable
              ? "Financial records need review"
              : "Clover comparison is waiting"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#062F24]/65">
          {daily.comparisonAvailable
            ? `${daily.unresolved} unresolved difference${daily.unresolved === 1 ? "" : "s"}.`
            : "Buffet Pin totals are available; no Clover closing comparison has been supplied yet."}
        </p>
      </AdminPanel>
    </AdminPage>
  );
}
