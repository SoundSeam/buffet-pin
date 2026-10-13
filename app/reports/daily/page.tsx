import FinancialSummary from "@/components/reports/financial-summary";
import { dailyPeriod, getFinancialSummary } from "@/lib/reports/financial";
import { requireStaffUser } from "@/lib/supabase/auth";

const todayKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export default async function DailyReport({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaffUser("REPORTING_READ");
  const query = await searchParams;
  const requested = Array.isArray(query.date) ? query.date[0] : query.date;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? "")
    ? requested!
    : todayKey();
  const summary = await getFinancialSummary(dailyPeriod(date));
  return (
    <FinancialSummary title="Daily report" summary={summary} mode="daily" />
  );
}
