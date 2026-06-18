"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Utensils,
  UserCheck,
} from "lucide-react";

type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
type RefundStatus = "NOT_REQUIRED" | "REQUIRED" | "PENDING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
type FulfillmentStatus =
  | "DRAFT"
  | "AWAITING_PAYMENT"
  | "AWAITING_ACCEPTANCE"
  | "ACCEPTED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DRIVER_ASSIGNED"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "ARRIVING_SOON"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

type PublicOrder = {
  publicCode: string;
  serviceType: "DELIVERY";
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  fulfillmentStatus: FulfillmentStatus;
  isAsap: boolean;
  requestedFor: string | null;
  estimatedReadyWindow: {
    startAt: string | null;
    endAt: string | null;
  };
  estimatedDeliveryWindow: {
    startAt: string | null;
    endAt: string | null;
  };
  totals: {
    itemsSubtotalCents: number;
    taxCents: number;
    tipCents: number;
    deliveryFeeCents: number;
    discountCents: number;
    totalCents: number;
    currency: string;
  };
  items: {
    name: string;
    description: string | null;
    quantity: number;
    unitPriceCents: number;
    modifiersTotalCents: number;
    lineSubtotalCents: number;
    specialInstructions: string | null;
    modifiers: {
      groupName: string;
      optionName: string;
      priceDeltaCents: number;
      quantity: number;
    }[];
  }[];
  timeline: {
    kind: "STATUS" | "REFUND";
    title: string;
    description: string | null;
    paymentStatus: PaymentStatus | null;
    fulfillmentStatus: FulfillmentStatus | null;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
};

type ApiResult =
  | { ok: true; data: { order: PublicOrder } }
  | { ok: false; error?: { code?: string; message?: string } };

const statusLabel = {
  DRAFT: "Order received",
  AWAITING_PAYMENT: "Order received",
  AWAITING_ACCEPTANCE: "Waiting confirmation",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready for delivery",
  DRIVER_ASSIGNED: "Driver assigned",
  PICKED_UP: "Picked up",
  ON_THE_WAY: "On the way",
  ARRIVING_SOON: "Arriving soon",
  DELIVERED: "Delivered",
  REJECTED: "Rejected/refund pending",
  CANCELLED: "Cancelled",
} satisfies Record<FulfillmentStatus, string>;

const paymentLabel = {
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
} satisfies Record<PaymentStatus, string>;

const refundLabel = {
  NOT_REQUIRED: "No refund required",
  REQUIRED: "Refund required",
  PENDING: "Refund pending",
  SUCCEEDED: "Refund completed",
  PARTIAL: "Partial refund",
  FAILED: "Refund needs review",
} satisfies Record<RefundStatus, string>;

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDateTime(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWindow(startAt: string | null, endAt: string | null) {
  const start = formatDateTime(startAt);
  const end = formatDateTime(endAt);

  if (start && end) return `${start} - ${end}`;
  return start ?? end ?? "Not set yet";
}

function currentStatusDescription(order: PublicOrder) {
  if (order.fulfillmentStatus === "REJECTED") {
    return order.refundStatus === "NOT_REQUIRED"
      ? "The order could not be accepted."
      : "The order could not be accepted. Refund status is shown below.";
  }

  if (order.paymentStatus !== "PAID") {
    return "The page updates after Clover confirms payment.";
  }

  if (order.fulfillmentStatus === "AWAITING_ACCEPTANCE") {
    return "The restaurant is reviewing your paid order.";
  }

  if (order.fulfillmentStatus === "READY_FOR_PICKUP") {
    return "Your order is ready for the delivery handoff.";
  }

  if (order.fulfillmentStatus === "ON_THE_WAY") {
    return "Your order is out for delivery.";
  }

  return "This status reflects the latest staff or driver update.";
}

function timelineIcon(title: string, isLatest: boolean) {
  const className = isLatest ? "text-[#062F24]" : "text-[#C9A56A]";
  const size = 20;

  if (title.includes("Rejected") || title.includes("failed")) {
    return <AlertCircle size={size} className="text-[#9F2A2A]" aria-hidden="true" />;
  }
  if (title.includes("Preparing")) {
    return <Utensils size={size} className={className} aria-hidden="true" />;
  }
  if (title.includes("Driver")) {
    return <UserCheck size={size} className={className} aria-hidden="true" />;
  }
  if (title.includes("Delivered") || title.includes("Ready") || title.includes("Picked")) {
    return <PackageCheck size={size} className={className} aria-hidden="true" />;
  }
  if (isLatest) {
    return <CheckCircle2 size={size} className={className} aria-hidden="true" />;
  }

  return <Circle size={size} className={className} aria-hidden="true" />;
}

function buildTimeline(order: PublicOrder) {
  if (order.timeline.length === 0) {
    return [
      {
        kind: "STATUS" as const,
        title: statusLabel[order.fulfillmentStatus],
        description: currentStatusDescription(order),
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        createdAt: order.updatedAt,
      },
    ];
  }

  const latest = order.timeline[order.timeline.length - 1];
  if (latest.fulfillmentStatus === order.fulfillmentStatus) {
    return order.timeline;
  }

  return [
    ...order.timeline,
    {
      kind: "STATUS" as const,
      title: statusLabel[order.fulfillmentStatus],
      description: currentStatusDescription(order),
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      createdAt: order.updatedAt,
    },
  ];
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[rgba(6,47,36,0.1)] py-4 last:border-b-0">
      <p className="text-xs font-bold uppercase text-[#062F24]/45">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#062F24]">{value}</p>
    </div>
  );
}

export default function CustomerStatusPage({ publicCode }: { publicCode: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOrder = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(publicCode)}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as ApiResult;

        if (!result.ok) {
          setOrder(null);
          setError(result.error?.message ?? "Order not found.");
          return;
        }

        setOrder(result.data.order);
      } catch {
        setError("Unable to load this order right now.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [publicCode],
  );

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId || document.visibilityState !== "visible") return;

      intervalId = setInterval(() => {
        if (document.visibilityState === "visible") {
          void loadOrder({ background: true });
        }
      }, 12_000);
    };

    const stopPolling = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadOrder({ background: true });
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadOrder]);

  const timeline = useMemo(() => (order ? buildTimeline(order) : []), [order]);

  if (loading) {
    return (
      <section className="bg-white px-6 py-28 text-[#062F24] lg:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Loader2 size={22} className="animate-spin" aria-hidden="true" />
          <p className="font-semibold">Loading order status...</p>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="bg-white px-6 py-28 text-[#062F24] lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-surface border border-[rgba(159,42,42,0.18)] bg-[rgba(159,42,42,0.06)] p-6">
            <AlertCircle size={24} className="text-[#9F2A2A]" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-extrabold">Order not found</h1>
            <p className="mt-3 text-sm leading-6 text-[#062F24]/65">
              {error || "Check the order code and try again."}
            </p>
            <Link
              href="/order"
              className="mt-6 inline-flex items-center justify-center rounded-button bg-[#C9A56A] px-5 py-3 font-extrabold text-[#062F24]"
            >
              Start an order
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white pb-20 text-[#062F24]">
      <div className="bg-[#062F24] pb-16 pt-28 lg:pt-32">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <p className="text-sm font-bold uppercase text-[#C9A56A]">Order {order.publicCode}</p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-extrabold leading-tight text-[#F4E8D2]">
                {statusLabel[order.fulfillmentStatus]}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[rgba(244,232,210,0.72)]">
                {currentStatusDescription(order)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadOrder({ background: true })}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-button border border-[#F4E8D2]/25 px-5 py-3 font-bold text-[#F4E8D2] transition hover:bg-white/10 disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={18} aria-hidden="true" />
              )}
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-8 px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="space-y-8">
          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Clock size={22} className="text-[#C9A56A]" aria-hidden="true" />
              <h2 className="text-2xl font-extrabold">Timeline</h2>
            </div>

            <div className="mt-6 space-y-5">
              {timeline.map((event, index) => {
                const isLatest = index === timeline.length - 1;
                return (
                  <div key={`${event.createdAt}-${event.kind}-${index}`} className="flex gap-4">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(6,47,36,0.12)] bg-[rgba(6,47,36,0.03)]">
                      {timelineIcon(event.title, isLatest)}
                    </div>
                    <div className="min-w-0 flex-1 border-b border-[rgba(6,47,36,0.08)] pb-5 last:border-b-0">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                        <h3 className="text-base font-extrabold">{event.title}</h3>
                        <time className="text-sm font-semibold text-[#062F24]/50">
                          {formatDateTime(event.createdAt)}
                        </time>
                      </div>
                      {event.description ? (
                        <p className="mt-2 text-sm leading-6 text-[#062F24]/65">
                          {event.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ReceiptText size={22} className="text-[#C9A56A]" aria-hidden="true" />
              <h2 className="text-2xl font-extrabold">Items</h2>
            </div>
            <div className="mt-5 divide-y divide-[rgba(6,47,36,0.08)]">
              {order.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-extrabold">
                        {item.quantity}x {item.name}
                      </p>
                      {item.description ? (
                        <p className="mt-1 text-sm leading-6 text-[#062F24]/60">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 font-bold">
                      {formatMoney(item.lineSubtotalCents, order.totals.currency)}
                    </p>
                  </div>
                  {item.modifiers.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm text-[#062F24]/65">
                      {item.modifiers.map((modifier, modifierIndex) => (
                        <li key={`${modifier.groupName}-${modifier.optionName}-${modifierIndex}`}>
                          {modifier.quantity > 1 ? `${modifier.quantity}x ` : ""}
                          {modifier.groupName}: {modifier.optionName}
                          {modifier.priceDeltaCents
                            ? ` (${formatMoney(modifier.priceDeltaCents, order.totals.currency)})`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.specialInstructions ? (
                    <p className="mt-3 rounded-surface bg-[rgba(6,47,36,0.04)] p-3 text-sm leading-6 text-[#062F24]/65">
                      {item.specialInstructions}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold">Status</h2>
            <div className="mt-4">
              <Detail label="Fulfillment" value={statusLabel[order.fulfillmentStatus]} />
              <Detail label="Payment" value={paymentLabel[order.paymentStatus]} />
              <Detail label="Refund" value={refundLabel[order.refundStatus]} />
              <Detail label="Service" value="Delivery" />
            </div>
          </div>

          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold">Estimated Windows</h2>
            <div className="mt-4">
              <Detail
                label="Ready window"
                value={formatWindow(
                  order.estimatedReadyWindow.startAt,
                  order.estimatedReadyWindow.endAt,
                )}
              />
              <Detail
                label="Delivery window"
                value={formatWindow(
                  order.estimatedDeliveryWindow.startAt,
                  order.estimatedDeliveryWindow.endAt,
                )}
              />
              <Detail
                label="Last updated"
                value={formatDateTime(order.updatedAt) ?? "Just now"}
              />
            </div>
          </div>

          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold">Total</h2>
            <div className="mt-4">
              <Detail
                label="Items"
                value={formatMoney(order.totals.itemsSubtotalCents, order.totals.currency)}
              />
              <Detail label="Tax" value={formatMoney(order.totals.taxCents, order.totals.currency)} />
              {order.totals.deliveryFeeCents > 0 ? (
                <Detail
                  label="Delivery"
                  value={formatMoney(order.totals.deliveryFeeCents, order.totals.currency)}
                />
              ) : null}
              {order.totals.tipCents > 0 ? (
                <Detail label="Tip" value={formatMoney(order.totals.tipCents, order.totals.currency)} />
              ) : null}
              <Detail label="Paid total" value={formatMoney(order.totals.totalCents, order.totals.currency)} />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
