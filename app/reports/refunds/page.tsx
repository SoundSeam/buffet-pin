import { RefundRecords } from "@/components/reports/financial-records";
import { getFinancialRefunds, monthlyPeriod } from "@/lib/reports/financial";
import { requireStaffUser } from "@/lib/supabase/auth";

const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
export default async function ReportRefunds({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaffUser("REPORTING_READ");
  const query = await searchParams;
  const requested = Array.isArray(query.month) ? query.month[0] : query.month;
  const month = /^\d{4}-\d{2}$/.test(requested ?? "")
    ? requested!
    : currentMonth();
  return (
    <RefundRecords
      rows={await getFinancialRefunds(monthlyPeriod(month))}
      period={month}
    />
  );
}
