import { NextResponse } from "next/server";

import {
  dailyPeriod,
  getFinancialOrders,
  getFinancialRefunds,
  getFinancialSummary,
  monthlyPeriod,
} from "@/lib/reports/financial";
import { getStaffUser } from "@/lib/supabase/auth";

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = (rows: unknown[][]) =>
  rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

export async function GET(request: Request) {
  if (!(await getStaffUser("REPORTING_READ")))
    return NextResponse.json({ ok: false }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") ?? "daily";
  const periodKey = params.get("period") ?? "";
  try {
    let rows: unknown[][];
    if (kind === "orders") {
      const records = await getFinancialOrders(monthlyPeriod(periodKey));
      rows = [
        [
          "Order",
          "Paid at",
          "Amount cents",
          "Tax cents",
          "Tip cents",
          "Delivery fee cents",
          "Refunded cents",
          "Status",
          "Clover payment reference",
        ],
        ...records.map((record) => [
          record.order.orderNumber,
          record.paidAt?.toISOString(),
          record.amountCents,
          record.order.taxCents,
          record.order.tipCents,
          record.order.deliveryFeeCents,
          record.refundedAmountCents,
          record.status,
          record.providerPaymentId,
        ]),
      ];
    } else if (kind === "refunds") {
      const records = await getFinancialRefunds(monthlyPeriod(periodKey));
      rows = [
        [
          "Order",
          "Requested at",
          "Amount cents",
          "Status",
          "Reason",
          "Resolved at",
        ],
        ...records.map((record) => [
          record.order.orderNumber,
          record.createdAt.toISOString(),
          record.amountCents,
          record.status,
          record.reason,
          record.resolvedAt?.toISOString(),
        ]),
      ];
    } else {
      const period =
        kind === "monthly" ? monthlyPeriod(periodKey) : dailyPeriod(periodKey);
      const summary = await getFinancialSummary(period);
      rows = [
        [
          "Period",
          "Orders",
          "Completed",
          "Sales cents",
          "Tax cents",
          "Tips cents",
          "Delivery fees cents",
          "Refunded cents",
          "Unresolved",
        ],
        [
          period.key,
          summary.orderCount,
          summary.completedOrders,
          summary.salesCents,
          summary.taxCents,
          summary.tipCents,
          summary.deliveryFeeCents,
          summary.refundedCents,
          summary.unresolved,
        ],
      ];
    }
    return new NextResponse(csv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="buffet-pin-${kind}-${periodKey}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_REPORT_PERIOD" } },
      { status: 400 },
    );
  }
}
