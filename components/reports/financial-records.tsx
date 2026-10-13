import Link from "next/link";
import { Download } from "lucide-react";

import {
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-page-ui";

const money = (cents: number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(
    cents / 100,
  );

export function OrderRecords({
  rows,
  period,
}: {
  rows: Array<{
    id: string;
    paidAt: Date | null;
    amountCents: number;
    refundedAmountCents: number;
    currency: string;
    status: string;
    refundStatus: string;
    providerPaymentId: string | null;
    order: {
      orderNumber: string;
      taxCents: number;
      tipCents: number;
      deliveryFeeCents: number;
      dispatchStatus: string;
    };
  }>;
  period: string;
}) {
  return (
    <AdminPage>
      <AdminPageHeader
        title="Order records"
        description="A read-only sales and payment paper trail."
        actions={
          <Link
            href={`/api/reports/export?kind=orders&period=${period}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-button border border-[#062F24]/15 px-4 text-sm font-semibold"
          >
            <Download size={15} /> Download CSV
          </Link>
        }
      />
      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        method="get"
      >
        <label className="grid gap-2 text-sm font-semibold">
          Choose a month
          <input
            className="min-h-11 rounded-button border border-[#062F24]/15 px-3"
            type="month"
            name="month"
            defaultValue={period}
          />
        </label>
        <button
          className="min-h-11 rounded-button bg-[#062F24] px-5 text-sm font-semibold text-white"
          type="submit"
        >
          Show records
        </button>
      </form>
      <div className="mt-8 grid gap-4">
        {rows.map((row) => (
          <AdminPanel key={row.id}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-lg font-extrabold">
                  {row.order.orderNumber}
                </h2>
                <p className="mt-1 text-sm text-[#062F24]/60">
                  {row.paidAt?.toLocaleString("en-CA") ??
                    "Payment time unavailable"}{" "}
                  ·{" "}
                  {row.order.dispatchStatus.replaceAll("_", " ").toLowerCase()}
                </p>
              </div>
              <strong className="text-xl">
                {money(row.amountCents, row.currency)}
              </strong>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
              <span>Tax {money(row.order.taxCents)}</span>
              <span>Tip {money(row.order.tipCents)}</span>
              <span>Delivery {money(row.order.deliveryFeeCents)}</span>
              <span>Refunded {money(row.refundedAmountCents)}</span>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Payment evidence
              </summary>
              <p className="mt-2 break-all text-xs text-[#062F24]/60">
                Clover payment reference:{" "}
                {row.providerPaymentId ?? "Unavailable"}
              </p>
            </details>
          </AdminPanel>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="mt-8">
          <AdminEmptyState>
            No paid orders were recorded for this period.
          </AdminEmptyState>
        </div>
      ) : null}
    </AdminPage>
  );
}

export function RefundRecords({
  rows,
  period,
}: {
  rows: Array<{
    id: string;
    createdAt: Date;
    amountCents: number;
    currency: string;
    status: string;
    reason: string;
    resolvedAt: Date | null;
    order: { orderNumber: string };
  }>;
  period: string;
}) {
  return (
    <AdminPage>
      <AdminPageHeader
        title="Refund records"
        description="A read-only record of requested and confirmed refunds."
        actions={
          <Link
            href={`/api/reports/export?kind=refunds&period=${period}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-button border border-[#062F24]/15 px-4 text-sm font-semibold"
          >
            <Download size={15} /> Download CSV
          </Link>
        }
      />
      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        method="get"
      >
        <label className="grid gap-2 text-sm font-semibold">
          Choose a month
          <input
            className="min-h-11 rounded-button border border-[#062F24]/15 px-3"
            type="month"
            name="month"
            defaultValue={period}
          />
        </label>
        <button
          className="min-h-11 rounded-button bg-[#062F24] px-5 text-sm font-semibold text-white"
          type="submit"
        >
          Show records
        </button>
      </form>
      <div className="mt-8 grid gap-4">
        {rows.map((row) => (
          <AdminPanel key={row.id}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <h2 className="text-lg font-extrabold">
                  {row.order.orderNumber}
                </h2>
                <p className="mt-1 text-sm text-[#062F24]/65">{row.reason}</p>
                <p className="mt-2 text-xs font-semibold text-[#062F24]/55">
                  {row.status.replaceAll("_", " ")} · requested{" "}
                  {row.createdAt.toLocaleString("en-CA")}
                </p>
              </div>
              <strong className="text-xl">
                {money(row.amountCents, row.currency)}
              </strong>
            </div>
          </AdminPanel>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="mt-8">
          <AdminEmptyState>
            No refunds were recorded for this period.
          </AdminEmptyState>
        </div>
      ) : null}
    </AdminPage>
  );
}
