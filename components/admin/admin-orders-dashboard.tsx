"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Check,
  Clock3,
  Eye,
  Loader2,
  Printer,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";

type ServiceType = "DELIVERY";
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

type AdminDriver = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type AdminOrder = {
  id: string;
  publicCode: string;
  serviceType: ServiceType;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  fulfillmentStatus: FulfillmentStatus;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  deliveryAddress: null | {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string | null;
    distanceKm: number | null;
    instructions: string | null;
  };
  isAsap: boolean;
  requestedFor: string | null;
  estimatedReadyStartAt: string | null;
  estimatedReadyEndAt: string | null;
  estimatedDeliveryStartAt: string | null;
  estimatedDeliveryEndAt: string | null;
  totals: {
    itemsSubtotalCents: number;
    taxCents: number;
    tipCents: number;
    deliveryFeeCents: number;
    discountCents: number;
    totalCents: number;
    currency: string;
  };
  customerNotes: string | null;
  internalNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    modifiersTotalCents: number;
    lineSubtotalCents: number;
    specialInstructions: string | null;
    modifiers: Array<{
      id: string;
      groupName: string;
      optionName: string;
      priceDeltaCents: number;
      quantity: number;
    }>;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    status: PaymentStatus;
    refundStatus: RefundStatus;
    amountCents: number;
    refundedAmountCents: number;
    paidAt: string | null;
  }>;
  driverAssignment: null | {
    id: string;
    status: string;
    assignedAt: string;
    driver: AdminDriver;
  };
  events: Array<{
    id: string;
    eventType: string;
    actorLabel: string | null;
    message: string | null;
    createdAt: string;
  }>;
};

type BucketKey =
  | "new"
  | "preparing"
  | "ready"
  | "delivery"
  | "completed"
  | "problem";

type LoadOptions = {
  foreground?: boolean;
  source?: "initial" | "manual" | "poll" | "mutation";
};

const POLL_INTERVAL_MS = 7000;

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-button px-3 py-2 text-xs font-bold transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50";
const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-button border transition hover:opacity-90 focus-visible:outline-none focus-visible:outline-0";
const fieldClass =
  "w-full rounded-button border border-[rgba(6,47,36,0.14)] bg-white px-3 py-2 text-sm text-[#062F24] focus:outline-none focus-visible:outline-none focus-visible:outline-0";
const primaryButtonStyle = {
  background: "#062F24",
  border: "1px solid #062F24",
  color: "#FFFFFF",
};
const quietButtonStyle = {
  background: "rgba(6,47,36,0.05)",
  border: "1px solid rgba(6,47,36,0.12)",
  color: "#062F24",
};
const dangerButtonStyle = {
  background: "#FFFFFF",
  border: "1px solid rgba(153,27,27,0.18)",
  color: "#7F1D1D",
};

const buckets: Array<{
  key: BucketKey;
  title: string;
  statuses: FulfillmentStatus[];
}> = [
  { key: "new", title: "New paid orders", statuses: ["AWAITING_ACCEPTANCE"] },
  { key: "preparing", title: "Preparing", statuses: ["ACCEPTED", "PREPARING"] },
  { key: "ready", title: "Ready", statuses: ["READY_FOR_PICKUP"] },
  {
    key: "delivery",
    title: "Out for delivery",
    statuses: ["DRIVER_ASSIGNED", "PICKED_UP", "ON_THE_WAY", "ARRIVING_SOON"],
  },
  { key: "completed", title: "Completed", statuses: ["DELIVERED"] },
  { key: "problem", title: "Problem/refund", statuses: ["REJECTED", "CANCELLED"] },
];

const statusLabel: Record<FulfillmentStatus | PaymentStatus | RefundStatus, string> = {
  DRAFT: "Draft",
  AWAITING_PAYMENT: "Awaiting payment",
  AWAITING_ACCEPTANCE: "Awaiting acceptance",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready",
  DRIVER_ASSIGNED: "Driver assigned",
  PICKED_UP: "Picked up",
  ON_THE_WAY: "On the way",
  ARRIVING_SOON: "Arriving soon",
  DELIVERED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  NOT_REQUIRED: "No refund",
  REQUIRED: "Refund required",
  SUCCEEDED: "Refunded",
  PARTIAL: "Partial refund",
};

function formatMoney(cents: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAddress(order: AdminOrder) {
  const address = order.deliveryAddress;
  if (!address) return "Delivery address unavailable";

  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function isProblemOrder(order: AdminOrder) {
  return (
    order.fulfillmentStatus === "REJECTED" ||
    order.fulfillmentStatus === "CANCELLED" ||
    order.refundStatus !== "NOT_REQUIRED" ||
    order.paymentStatus === "REFUNDED" ||
    order.paymentStatus === "PARTIALLY_REFUNDED"
  );
}

function bucketForOrder(order: AdminOrder): BucketKey | null {
  if (isProblemOrder(order)) return "problem";
  return buckets.find((bucket) => bucket.statuses.includes(order.fulfillmentStatus))?.key ?? null;
}

function formatApiError(
  result: { error?: { code?: string; message?: string; details?: unknown } },
  fallback: string,
) {
  const message = result.error?.message ?? fallback;
  return result.error?.code ? `${message} (${result.error.code})` : message;
}

export default function AdminOrdersDashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [prepEstimateByOrder, setPrepEstimateByOrder] = useState<Record<string, string>>({});
  const [driverByOrder, setDriverByOrder] = useState<Record<string, string>>({});
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  const loadOrders = useCallback(async (options: LoadOptions = {}) => {
    const foreground = options.foreground ?? options.source !== "poll";

    if (foreground) {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const result = await response.json();

      if (!result.ok) {
        setError(formatApiError(result, "Unable to load orders."));
        return;
      }

      const nextOrders = result.data.orders as AdminOrder[];
      setOrders(nextOrders);
      setDrivers(result.data.drivers as AdminDriver[]);
      setDriverByOrder((current) => {
        const next = { ...current };
        nextOrders.forEach((order) => {
          if (order.driverAssignment) {
            next[order.id] = order.driverAssignment.driver.id;
          }
        });
        return next;
      });
      setError("");
    } catch {
      if (foreground) {
        setError("Unable to load orders.");
      }
    } finally {
      setLoading(false);
      if (foreground) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadOrders({ source: "initial", foreground: true });
  }, [loadOrders]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busyOrderId) {
        void loadOrders({ source: "poll", foreground: false });
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadOrders({ source: "poll", foreground: false });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [busyOrderId, loadOrders]);

  const groupedOrders = useMemo(() => {
    const grouped: Record<BucketKey, AdminOrder[]> = {
      new: [],
      preparing: [],
      ready: [],
      delivery: [],
      completed: [],
      problem: [],
    };

    orders.forEach((order) => {
      const bucket = bucketForOrder(order);
      if (bucket) {
        grouped[bucket].push(order);
      }
    });

    return grouped;
  }, [orders]);

  const replaceOrder = (order: AdminOrder) => {
    setOrders((current) => current.map((item) => (item.id === order.id ? order : item)));
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(order);
    }
  };

  const mutateOrder = async ({
    order,
    endpoint,
    method,
    body,
    successMessage,
  }: {
    order: AdminOrder;
    endpoint: string;
    method: "POST" | "PATCH";
    body?: unknown;
    successMessage: string;
  }) => {
    setBusyOrderId(order.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const result = await response.json();

      if (!result.ok) {
        setError(formatApiError(result, "Unable to update order."));
        return;
      }

      replaceOrder(result.data.order as AdminOrder);
      setSuccess(successMessage);
    } catch {
      setError("Unable to update order.");
    } finally {
      setBusyOrderId(null);
    }
  };

  const acceptOrder = (order: AdminOrder) => {
    const prepEstimate = Number(prepEstimateByOrder[order.id] || "25");
    void mutateOrder({
      order,
      endpoint: `/api/admin/orders/${order.id}/accept`,
      method: "POST",
      body: { prepEstimateMinutes: prepEstimate },
      successMessage: `${order.publicCode} accepted.`,
    });
  };

  const rejectOrder = (order: AdminOrder) => {
    const reason = window.prompt("Reason for rejection/refund");
    if (!reason?.trim()) return;

    void mutateOrder({
      order,
      endpoint: `/api/admin/orders/${order.id}/reject`,
      method: "POST",
      body: { reason },
      successMessage: `${order.publicCode} rejected.`,
    });
  };

  const updateStatus = (order: AdminOrder, status: FulfillmentStatus) => {
    void mutateOrder({
      order,
      endpoint: `/api/admin/orders/${order.id}/status`,
      method: "PATCH",
      body: { status },
      successMessage: `${order.publicCode} moved to ${statusLabel[status]}.`,
    });
  };

  const assignDriver = (order: AdminOrder) => {
    const driverId = driverByOrder[order.id];
    if (!driverId) {
      setError("Choose a driver before assigning.");
      return;
    }

    void mutateOrder({
      order,
      endpoint: `/api/admin/orders/${order.id}/assign-driver`,
      method: "PATCH",
      body: { driverId },
      successMessage: `${order.publicCode} assigned.`,
    });
  };

  const printOrder = (order: AdminOrder) => {
    setSelectedOrder(order);
    window.setTimeout(() => window.print(), 100);
  };

  return (
    <section className="pb-20 pt-36 lg:pt-40" style={{ background: "#FFFFFF" }}>
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#062F24]/70 transition hover:text-[#062F24]"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Admin
            </Link>
            <h1 className="mt-4 text-3xl font-extrabold leading-none text-[#062F24]">
              Orders
            </h1>
            <p className="mt-2 text-sm font-medium text-[#062F24]/65">
              Paid fulfillment queue. Polls every {Math.round(POLL_INTERVAL_MS / 1000)} seconds while visible.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/reservations" className={buttonClass} style={quietButtonStyle}>
              Reservations
            </Link>
            <Link href="/admin/settings/orders" className={buttonClass} style={quietButtonStyle}>
              Settings
            </Link>
            <button
              type="button"
              className={buttonClass}
              onClick={() => void loadOrders({ source: "manual", foreground: true })}
              disabled={refreshing}
              style={primaryButtonStyle}
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>
        </div>

        {(error || success) && (
          <div
            className="mt-5 rounded-card border px-4 py-3 text-sm font-semibold"
            style={
              error
                ? { borderColor: "rgba(153,27,27,0.18)", color: "#7F1D1D", background: "#FFF6F3" }
                : { borderColor: "rgba(6,95,70,0.18)", color: "#065F46", background: "#F0FDF4" }
            }
          >
            {error || success}
          </div>
        )}

        {loading ? (
          <div className="mt-12 flex items-center justify-center gap-3 text-sm font-semibold text-[#062F24]/70">
            <Loader2 size={18} className="animate-spin" />
            Loading orders
          </div>
        ) : (
          <div className="mt-8 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {buckets.map((bucket) => (
              <section
                key={bucket.key}
                className="min-h-[220px] rounded-card border border-[rgba(6,47,36,0.12)] bg-[rgba(6,47,36,0.025)] p-3"
              >
                <div className="flex items-center justify-between gap-3 px-1 pb-3">
                  <h2 className="text-base font-extrabold text-[#062F24]">{bucket.title}</h2>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-[#062F24]">
                    {groupedOrders[bucket.key].length}
                  </span>
                </div>

                <div className="space-y-3">
                  {groupedOrders[bucket.key].length === 0 ? (
                    <div className="rounded-card border border-dashed border-[rgba(6,47,36,0.14)] bg-white px-4 py-8 text-center text-sm font-semibold text-[#062F24]/50">
                      No orders
                    </div>
                  ) : (
                    groupedOrders[bucket.key].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        drivers={drivers}
                        busy={busyOrderId === order.id}
                        prepEstimate={prepEstimateByOrder[order.id] ?? "25"}
                        selectedDriverId={driverByOrder[order.id] ?? ""}
                        onPrepEstimateChange={(value) =>
                          setPrepEstimateByOrder((current) => ({
                            ...current,
                            [order.id]: value,
                          }))
                        }
                        onDriverChange={(value) =>
                          setDriverByOrder((current) => ({ ...current, [order.id]: value }))
                        }
                        onAccept={() => acceptOrder(order)}
                        onReject={() => rejectOrder(order)}
                        onStatus={(status) => updateStatus(order, status)}
                        onAssignDriver={() => assignDriver(order)}
                        onView={() => setSelectedOrder(order)}
                        onPrint={() => printOrder(order)}
                      />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onPrint={() => window.print()}
        />
      )}
    </section>
  );
}

function OrderCard({
  order,
  drivers,
  busy,
  prepEstimate,
  selectedDriverId,
  onPrepEstimateChange,
  onDriverChange,
  onAccept,
  onReject,
  onStatus,
  onAssignDriver,
  onView,
  onPrint,
}: {
  order: AdminOrder;
  drivers: AdminDriver[];
  busy: boolean;
  prepEstimate: string;
  selectedDriverId: string;
  onPrepEstimateChange: (value: string) => void;
  onDriverChange: (value: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onStatus: (status: FulfillmentStatus) => void;
  onAssignDriver: () => void;
  onView: () => void;
  onPrint: () => void;
}) {
  return (
    <article className="rounded-card border border-[rgba(6,47,36,0.12)] bg-white p-4 shadow-[0_10px_24px_rgba(6,47,36,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-extrabold text-[#062F24]">{order.publicCode}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F7E7CF] px-2 py-1 text-[11px] font-extrabold uppercase text-[#6D3F12]">
              <Truck size={12} />
              Delivery
            </span>
            <span className="rounded-full bg-[#E8F3EF] px-2 py-1 text-[11px] font-extrabold uppercase text-[#062F24]">
              {order.isAsap ? "ASAP" : formatTime(order.requestedFor)}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-[#062F24]/55">
            Created {formatTime(order.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" className={iconButtonClass} onClick={onView} style={quietButtonStyle} title="View">
            <Eye size={15} />
          </button>
          <button type="button" className={iconButtonClass} onClick={onPrint} style={quietButtonStyle} title="Print">
            <Printer size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-[#062F24]">
        <div>
          <p className="font-extrabold">{order.customer.name}</p>
          <a className="font-semibold text-[#062F24]/70" href={`tel:${order.customer.phone}`}>
            {order.customer.phone}
          </a>
        </div>
        <p className="font-semibold text-[#062F24]/70">{formatAddress(order)}</p>
        {order.deliveryAddress?.instructions && (
          <p className="rounded-button bg-[#FFF7D6] px-3 py-2 text-xs font-semibold text-[#7C5A16]">
            {order.deliveryAddress.instructions}
          </p>
        )}
      </div>

      <div className="mt-3 space-y-2 border-y border-[rgba(6,47,36,0.1)] py-3">
        {order.items.map((item) => (
          <div key={item.id} className="text-sm text-[#062F24]">
            <div className="flex items-start justify-between gap-3">
              <span className="font-extrabold">
                {item.quantity}x {item.name}
              </span>
              <span className="shrink-0 font-bold">
                {formatMoney(item.lineSubtotalCents, order.totals.currency)}
              </span>
            </div>
            {item.modifiers.length > 0 && (
              <p className="mt-1 text-xs font-semibold text-[#062F24]/60">
                {item.modifiers
                  .map((modifier) => `${modifier.groupName}: ${modifier.optionName}`)
                  .join("; ")}
              </p>
            )}
            {item.specialInstructions && (
              <p className="mt-1 text-xs font-semibold text-[#7C5A16]">
                {item.specialInstructions}
              </p>
            )}
          </div>
        ))}
      </div>

      {(order.customerNotes || order.internalNotes || order.rejectionReason) && (
        <div className="mt-3 space-y-1 text-xs font-semibold text-[#062F24]/70">
          {order.customerNotes && <p>Customer: {order.customerNotes}</p>}
          {order.internalNotes && <p>Internal: {order.internalNotes}</p>}
          {order.rejectionReason && <p>Rejected: {order.rejectionReason}</p>}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-extrabold text-[#062F24]">
        <StatusPill label={`Payment: ${statusLabel[order.paymentStatus]}`} />
        <StatusPill label={`Refund: ${statusLabel[order.refundStatus]}`} />
        <StatusPill label={`Fulfillment: ${statusLabel[order.fulfillmentStatus]}`} />
        <StatusPill label={`Total: ${formatMoney(order.totals.totalCents, order.totals.currency)}`} />
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#062F24]/65">
        <Clock3 size={14} />
        Ready by {formatTime(order.estimatedReadyEndAt)}
      </div>

      <div className="mt-4 space-y-2">
        {order.fulfillmentStatus === "AWAITING_ACCEPTANCE" && (
          <>
            <div className="flex items-center gap-2">
              <input
                className={fieldClass}
                type="number"
                min={5}
                max={180}
                value={prepEstimate}
                onChange={(event) => onPrepEstimateChange(event.target.value)}
                aria-label="Prep estimate minutes"
              />
              <span className="shrink-0 text-xs font-bold text-[#062F24]/60">min</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={buttonClass} onClick={onAccept} disabled={busy} style={primaryButtonStyle}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Accept
              </button>
              <button type="button" className={buttonClass} onClick={onReject} disabled={busy} style={dangerButtonStyle}>
                <X size={14} />
                Reject
              </button>
            </div>
          </>
        )}

        {order.fulfillmentStatus === "ACCEPTED" && (
          <button type="button" className={buttonClass} onClick={() => onStatus("PREPARING")} disabled={busy} style={primaryButtonStyle}>
            Preparing
          </button>
        )}

        {order.fulfillmentStatus === "PREPARING" && (
          <button type="button" className={buttonClass} onClick={() => onStatus("READY_FOR_PICKUP")} disabled={busy} style={primaryButtonStyle}>
            Ready
          </button>
        )}

        {order.fulfillmentStatus === "READY_FOR_PICKUP" && (
          <div className="grid gap-2">
            <select
              className={fieldClass}
              value={selectedDriverId}
              onChange={(event) => onDriverChange(event.target.value)}
              disabled={drivers.length === 0 || busy}
              aria-label="Driver"
            >
              <option value="">Choose driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
            <button type="button" className={buttonClass} onClick={onAssignDriver} disabled={busy || drivers.length === 0} style={primaryButtonStyle}>
              <Bike size={14} />
              Assign driver
            </button>
          </div>
        )}

        {order.fulfillmentStatus === "DRIVER_ASSIGNED" && (
          <button type="button" className={buttonClass} onClick={() => onStatus("PICKED_UP")} disabled={busy} style={primaryButtonStyle}>
            Picked up
          </button>
        )}

        {order.fulfillmentStatus === "PICKED_UP" && (
          <button type="button" className={buttonClass} onClick={() => onStatus("ON_THE_WAY")} disabled={busy} style={primaryButtonStyle}>
            On the way
          </button>
        )}

        {order.fulfillmentStatus === "ON_THE_WAY" && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={buttonClass} onClick={() => onStatus("ARRIVING_SOON")} disabled={busy} style={quietButtonStyle}>
              Arriving soon
            </button>
            <button type="button" className={buttonClass} onClick={() => onStatus("DELIVERED")} disabled={busy} style={primaryButtonStyle}>
              Delivered
            </button>
          </div>
        )}

        {order.fulfillmentStatus === "ARRIVING_SOON" && (
          <button type="button" className={buttonClass} onClick={() => onStatus("DELIVERED")} disabled={busy} style={primaryButtonStyle}>
            Delivered
          </button>
        )}
      </div>

      {order.driverAssignment && (
        <p className="mt-3 text-xs font-bold text-[#062F24]/65">
          Driver: {order.driverAssignment.driver.name} ({order.driverAssignment.status})
        </p>
      )}
    </article>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-button bg-[rgba(6,47,36,0.05)] px-2.5 py-1.5 text-[11px]">
      {label}
    </span>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onPrint,
}: {
  order: AdminOrder;
  onClose: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 print:static print:block print:bg-white print:p-0">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-card bg-white p-6 shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:shadow-none">
        <div className="flex items-start justify-between gap-4 print:hidden">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#062F24]/50">
              Order
            </p>
            <h2 className="text-2xl font-extrabold text-[#062F24]">{order.publicCode}</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" className={buttonClass} onClick={onPrint} style={quietButtonStyle}>
              <Printer size={14} />
              Print
            </button>
            <button type="button" className={buttonClass} onClick={onClose} style={dangerButtonStyle}>
              Close
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 text-sm text-[#062F24] md:grid-cols-2 print:mt-0">
          <section>
            <h3 className="font-extrabold">Customer</h3>
            <p className="mt-2 font-semibold">{order.customer.name}</p>
            <p>{order.customer.phone}</p>
            {order.customer.email && <p>{order.customer.email}</p>}
            <p className="mt-3 font-semibold">{formatAddress(order)}</p>
            {order.deliveryAddress?.instructions && <p>{order.deliveryAddress.instructions}</p>}
          </section>

          <section>
            <h3 className="font-extrabold">Status</h3>
            <p className="mt-2">Payment: {statusLabel[order.paymentStatus]}</p>
            <p>Refund: {statusLabel[order.refundStatus]}</p>
            <p>Fulfillment: {statusLabel[order.fulfillmentStatus]}</p>
            <p>Ready by: {formatTime(order.estimatedReadyEndAt)}</p>
            {order.driverAssignment && <p>Driver: {order.driverAssignment.driver.name}</p>}
          </section>
        </div>

        <section className="mt-6 border-y border-[rgba(6,47,36,0.12)] py-4 text-[#062F24]">
          <h3 className="font-extrabold">Items</h3>
          <div className="mt-3 space-y-3">
            {order.items.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between gap-4 font-bold">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span>{formatMoney(item.lineSubtotalCents, order.totals.currency)}</span>
                </div>
                {item.modifiers.length > 0 && (
                  <p className="mt-1 text-sm text-[#062F24]/65">
                    {item.modifiers
                      .map((modifier) => `${modifier.groupName}: ${modifier.optionName}`)
                      .join("; ")}
                  </p>
                )}
                {item.specialInstructions && (
                  <p className="mt-1 text-sm font-semibold text-[#7C5A16]">
                    {item.specialInstructions}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 text-sm text-[#062F24]">
          <div className="ml-auto max-w-sm space-y-1">
            <TotalLine label="Subtotal" value={order.totals.itemsSubtotalCents} currency={order.totals.currency} />
            <TotalLine label="Tax" value={order.totals.taxCents} currency={order.totals.currency} />
            <TotalLine label="Delivery" value={order.totals.deliveryFeeCents} currency={order.totals.currency} />
            <TotalLine label="Tip" value={order.totals.tipCents} currency={order.totals.currency} />
            <TotalLine label="Discount" value={-order.totals.discountCents} currency={order.totals.currency} />
            <div className="flex justify-between border-t border-[rgba(6,47,36,0.12)] pt-2 text-base font-extrabold">
              <span>Total</span>
              <span>{formatMoney(order.totals.totalCents, order.totals.currency)}</span>
            </div>
          </div>
        </section>

        {(order.customerNotes || order.internalNotes || order.rejectionReason) && (
          <section className="mt-6 text-sm text-[#062F24]">
            <h3 className="font-extrabold">Notes</h3>
            {order.customerNotes && <p className="mt-2">Customer: {order.customerNotes}</p>}
            {order.internalNotes && <p>Internal: {order.internalNotes}</p>}
            {order.rejectionReason && <p>Rejected: {order.rejectionReason}</p>}
          </section>
        )}

        <section className="mt-6 text-xs text-[#062F24]/65 print:hidden">
          <h3 className="font-extrabold text-[#062F24]">Recent events</h3>
          <div className="mt-2 space-y-1">
            {order.events.slice(0, 8).map((event) => (
              <p key={event.id}>
                {formatTime(event.createdAt)} - {event.eventType}
                {event.actorLabel ? ` by ${event.actorLabel}` : ""}
                {event.message ? `: ${event.message}` : ""}
              </p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TotalLine({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: string;
}) {
  if (value === 0) return null;

  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{formatMoney(value, currency)}</span>
    </div>
  );
}
