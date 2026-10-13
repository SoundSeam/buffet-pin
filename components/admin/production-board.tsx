"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Search } from "lucide-react";

import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminSectionHeading,
  AdminStatusPill,
  adminButtonClass,
  adminCompactButtonClass,
  adminFieldClass,
  adminPrimaryButtonStyle,
  adminQuietButtonStyle,
} from "@/components/admin/admin-page-ui";

type Item = {
  id: string;
  name: string;
  quantity: number;
  specialInstructions: string | null;
  modifiers: Array<{
    id: string;
    groupName: string;
    optionName: string;
    quantity: number;
  }>;
};
type Order = {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  refundStatus: string;
  productionStatus: string;
  dispatchStatus: string;
  printJobs: Array<{ purpose: string; status: string }>;
  packingChecks: Array<{ orderItemId: string }>;
  items: Item[];
};
const nextState: Record<string, string | undefined> = {
  AWAITING_ACCEPTANCE: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "PACKING",
  PACKING: "PACKED",
  PACKED: "AT_DISPATCH_DESK",
};

export default function ProductionBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/orders?limit=200", {
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(
        body.error?.message ?? "Unable to load production queue.",
      );
    setOrders(body.data.orders);
  }, []);
  useEffect(() => {
    void load().catch((caught) => setError(String(caught)));
  }, [load]);
  const visible = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.paymentStatus === "PAID" &&
          !["REJECTED", "CANCELLED", "AT_DISPATCH_DESK"].includes(
            order.productionStatus,
          ) &&
          order.orderNumber.toLowerCase().includes(search.toLowerCase()),
      ),
    [orders, search],
  );
  const stoppedPaidOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          ["REJECTED", "CANCELLED"].includes(order.productionStatus) &&
          ["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus),
      ),
    [orders],
  );
  const post = async (orderId: string, payload: object) => {
    setError("");
    const response = await fetch(`/api/admin/orders/${orderId}/production`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(
        body.error?.message ?? body.error?.code ?? "Action failed.",
      );
    await load();
  };
  return (
    <AdminPage>
      <AdminPageHeader
        title="Production & packing"
        description="Paid orders only. A confirmed Clover ticket or physically confirmed fallback is required before acceptance."
        actions={
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Search by order number</span>
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#062F24]/45"
            />
            <input
              className={`${adminFieldClass} pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order number"
            />
          </label>
        }
      />
      {error ? (
        <AdminNotice tone="error" role="alert" className="mt-6">
          {error}
        </AdminNotice>
      ) : null}
      {stoppedPaidOrders.length > 0 && (
        <section
          aria-label="Paid cancellation and rejection warnings"
          className="mt-6 rounded-surface-lg border border-red-900/25 bg-red-50 p-5 text-red-950 shadow-sm sm:p-6"
        >
          <h2 className="text-lg font-extrabold">
            Stop-production / refund warnings
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-red-900/75">
            Keep these bags out of production and dispatch. A paid stop must
            remain visible until its durable refund workflow is resolved.
          </p>
          <ul className="mt-4 grid gap-3">
            {stoppedPaidOrders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center gap-2 rounded-surface border border-red-900/15 bg-white px-4 py-3 text-sm"
              >
                <strong>{order.orderNumber}</strong>
                <AdminStatusPill>{order.productionStatus}</AdminStatusPill>
                <span className="text-red-900/70">
                  Refund {order.refundStatus}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-8">
        <AdminSectionHeading
          title={`Active production queue (${visible.length})`}
          description="Advance an order only after the physical handoff shown by the current state is complete."
        />
        <div className="mt-4 grid gap-4">
          {visible.map((order) => {
            const next = nextState[order.productionStatus];
            const confirmedPrint = order.printJobs.find(
              (job) =>
                ["INITIAL", "FALLBACK"].includes(job.purpose) &&
                job.status === "PRINTED",
            );
            return (
              <AdminPanel key={order.id} as="article">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#062F24]">
                      {order.orderNumber}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <AdminStatusPill>
                        {order.productionStatus}
                      </AdminStatusPill>
                      <AdminStatusPill>
                        {confirmedPrint
                          ? `${confirmedPrint.purpose} ticket printed`
                          : "Ticket missing"}
                      </AdminStatusPill>
                    </div>
                  </div>
                  {next && (
                    <button
                      type="button"
                      className={adminButtonClass}
                      style={adminPrimaryButtonStyle}
                      onClick={() =>
                        void post(order.id, {
                          action: "transition",
                          expected: order.productionStatus,
                          next,
                        }).catch((caught) => setError(String(caught)))
                      }
                    >
                      {next.replaceAll("_", " ")}
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
                {order.productionStatus === "PACKING" && (
                  <ul className="mt-5 divide-y divide-[#062F24]/10 overflow-hidden rounded-surface border border-[#062F24]/10">
                    {order.items.map((item) => {
                      const checked = order.packingChecks.some(
                        (check) => check.orderItemId === item.id,
                      );
                      return (
                        <li
                          key={item.id}
                          className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-start"
                        >
                          <span className="min-w-0 text-[#062F24]">
                            <strong className="text-sm">
                              {item.quantity}× {item.name}
                            </strong>
                            {item.modifiers.length > 0 && (
                              <span className="mt-1 block text-sm leading-relaxed text-[#062F24]/65">
                                {item.modifiers
                                  .map(
                                    (modifier) =>
                                      `${modifier.quantity}× ${modifier.groupName}: ${modifier.optionName}`,
                                  )
                                  .join(" · ")}
                              </span>
                            )}
                            {item.specialInstructions && (
                              <span className="mt-2 block rounded-button border border-amber-900/15 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                Instruction: {item.specialInstructions}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={checked}
                            className={`${adminCompactButtonClass} shrink-0`}
                            style={adminQuietButtonStyle}
                            onClick={() =>
                              void post(order.id, {
                                action: "verify_item",
                                orderItemId: item.id,
                                quantity: item.quantity,
                                instructionsAcknowledged: true,
                              }).catch((caught) => setError(String(caught)))
                            }
                          >
                            {checked ? <Check size={14} /> : null}
                            {checked
                              ? "Verified"
                              : item.specialInstructions
                                ? "Verify modifiers, qty & instruction"
                                : "Verify modifiers & qty"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </AdminPanel>
            );
          })}
          {visible.length === 0 && (
            <AdminEmptyState>
              No paid orders currently need production action.
            </AdminEmptyState>
          )}
        </div>
      </section>
    </AdminPage>
  );
}
