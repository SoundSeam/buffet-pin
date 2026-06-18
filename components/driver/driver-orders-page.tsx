"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  RefreshCw,
  Truck,
} from "lucide-react";

type AssignmentStatus =
  | "ASSIGNED"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "ARRIVING_SOON"
  | "DELIVERED";

type DriverOrder = {
  id: string;
  publicCode: string;
  fulfillmentStatus: string;
  assignmentStatus: AssignmentStatus | null;
  customer: {
    name: string;
    phone: string;
  };
  deliveryAddress: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string | null;
    distanceKm: number | null;
    instructions: string | null;
    formatted: string;
    mapUrl: string | null;
  };
  estimatedDeliveryStartAt: string | null;
  estimatedDeliveryEndAt: string | null;
  customerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
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
  }>;
};

type DriverInfo = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type ApiResult =
  | { ok: true; data: { driver?: DriverInfo; orders?: DriverOrder[]; order?: DriverOrder } }
  | { ok: false; error?: { code?: string; message?: string } };

const POLL_INTERVAL_MS = 10000;

const statusLabel = {
  ASSIGNED: "Assigned",
  PICKED_UP: "Picked up",
  ON_THE_WAY: "On the way",
  ARRIVING_SOON: "Arriving soon",
  DELIVERED: "Delivered",
} satisfies Record<AssignmentStatus, string>;

const nextStatus = {
  ASSIGNED: "PICKED_UP",
  PICKED_UP: "ON_THE_WAY",
  ON_THE_WAY: "ARRIVING_SOON",
  ARRIVING_SOON: "DELIVERED",
  DELIVERED: null,
} satisfies Record<AssignmentStatus, AssignmentStatus | null>;

function formatTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWindow(startAt: string | null, endAt: string | null) {
  const start = formatTime(startAt);
  const end = formatTime(endAt);
  if (startAt && endAt) return `${start} - ${end}`;
  return startAt || endAt ? start : "Not set";
}

function formatApiError(result: ApiResult, fallback: string) {
  const message = "error" in result ? result.error?.message : null;
  const code = "error" in result ? result.error?.code : null;
  return code ? `${message ?? fallback} (${code})` : message ?? fallback;
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function StatusBadge({ status }: { status: AssignmentStatus | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-button bg-[rgba(6,47,36,0.08)] px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-[#062F24]">
      <Truck size={14} aria-hidden="true" />
      {status ? statusLabel[status] : "Assigned"}
    </span>
  );
}

function OrderSummaryCard({ order }: { order: DriverOrder }) {
  return (
    <Link
      href={`/driver/orders/${order.id}`}
      className="block rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[#8A6D3F]">Order {order.publicCode}</p>
          <h2 className="mt-1 text-xl font-extrabold">{order.customer.name}</h2>
        </div>
        <StatusBadge status={order.assignmentStatus} />
      </div>
      <div className="mt-4 grid gap-3 text-sm text-[#062F24]/75 sm:grid-cols-2">
        <p className="inline-flex items-start gap-2">
          <MapPin size={16} className="mt-0.5 shrink-0 text-[#C9A56A]" aria-hidden="true" />
          <span>{order.deliveryAddress.formatted || "Address unavailable"}</span>
        </p>
        <p className="inline-flex items-center gap-2">
          <Clock3 size={16} className="text-[#C9A56A]" aria-hidden="true" />
          {formatWindow(order.estimatedDeliveryStartAt, order.estimatedDeliveryEndAt)}
        </p>
      </div>
    </Link>
  );
}

function OrderDetail({
  order,
  updating,
  onStatusUpdate,
}: {
  order: DriverOrder;
  updating: AssignmentStatus | "";
  onStatusUpdate: (status: AssignmentStatus) => void;
}) {
  const activeStatus = order.assignmentStatus ?? "ASSIGNED";
  const next = nextStatus[activeStatus];

  return (
    <div className="space-y-5">
      <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[#8A6D3F]">Order {order.publicCode}</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight">{order.customer.name}</h1>
            <a
              href={phoneHref(order.customer.phone)}
              className="mt-4 inline-flex items-center gap-2 rounded-button bg-[#062F24] px-4 py-3 text-sm font-extrabold text-white transition hover:opacity-90"
            >
              <Phone size={16} aria-hidden="true" />
              {order.customer.phone}
            </a>
          </div>
          <StatusBadge status={order.assignmentStatus} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-[rgba(6,47,36,0.04)] p-4">
            <p className="text-xs font-bold uppercase text-[#8A6D3F]">Address</p>
            <p className="mt-2 text-lg font-bold">{order.deliveryAddress.formatted}</p>
            {order.deliveryAddress.mapUrl ? (
              <a
                href={order.deliveryAddress.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-button border border-[rgba(6,47,36,0.16)] bg-white px-4 py-3 text-sm font-extrabold text-[#062F24] transition hover:opacity-90"
              >
                <Navigation size={16} aria-hidden="true" />
                Open map
              </a>
            ) : null}
          </div>
          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-[rgba(201,165,106,0.12)] p-4">
            <p className="text-xs font-bold uppercase text-[#8A6D3F]">Delivery window</p>
            <p className="mt-2 text-lg font-bold">
              {formatWindow(order.estimatedDeliveryStartAt, order.estimatedDeliveryEndAt)}
            </p>
            {order.deliveryAddress.distanceKm !== null ? (
              <p className="mt-2 text-sm text-[#062F24]/70">
                {order.deliveryAddress.distanceKm.toFixed(1)} km
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm">
        <h2 className="text-xl font-extrabold">Status</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {(["PICKED_UP", "ON_THE_WAY", "ARRIVING_SOON", "DELIVERED"] as const).map((status) => {
            const enabled = next === status;
            const complete =
              activeStatus === status ||
              (status === "PICKED_UP" &&
                ["ON_THE_WAY", "ARRIVING_SOON", "DELIVERED"].includes(activeStatus)) ||
              (status === "ON_THE_WAY" &&
                ["ARRIVING_SOON", "DELIVERED"].includes(activeStatus)) ||
              (status === "ARRIVING_SOON" && activeStatus === "DELIVERED");

            return (
              <button
                key={status}
                type="button"
                disabled={!enabled || Boolean(updating)}
                onClick={() => onStatusUpdate(status)}
                className="inline-flex min-w-36 items-center justify-center gap-2 rounded-button border px-4 py-3 text-sm font-extrabold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: complete ? "#062F24" : "#FFFFFF",
                  borderColor: complete ? "#062F24" : "rgba(6,47,36,0.16)",
                  color: complete ? "#FFFFFF" : "#062F24",
                }}
              >
                {updating === status ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : complete ? (
                  <CheckCircle2 size={16} aria-hidden="true" />
                ) : (
                  <PackageCheck size={16} aria-hidden="true" />
                )}
                {statusLabel[status]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm">
          <h2 className="text-xl font-extrabold">Order contents</h2>
          <div className="mt-4 divide-y divide-[rgba(6,47,36,0.1)]">
            {order.items.map((item) => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-extrabold">{item.name}</p>
                    {item.modifiers.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm text-[#062F24]/70">
                        {item.modifiers.map((modifier) => (
                          <li key={modifier.id}>
                            {modifier.groupName}: {modifier.optionName}
                            {modifier.quantity > 1 ? ` x${modifier.quantity}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {item.specialInstructions ? (
                      <p className="mt-2 rounded-button bg-[rgba(201,165,106,0.14)] px-3 py-2 text-sm font-semibold text-[#062F24]">
                        {item.specialInstructions}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-button bg-[rgba(6,47,36,0.08)] px-3 py-2 text-sm font-extrabold">
                    x{item.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm">
          <h2 className="text-xl font-extrabold">Delivery notes</h2>
          <div className="mt-4 space-y-4 text-sm text-[#062F24]/75">
            <div>
              <p className="text-xs font-bold uppercase text-[#8A6D3F]">Instructions</p>
              <p className="mt-1">
                {order.deliveryAddress.instructions || "No delivery instructions."}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-[#8A6D3F]">Customer notes</p>
              <p className="mt-1">{order.customerNotes || "No customer notes."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DriverOrdersPage({ orderId }: { orderId?: string }) {
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [order, setOrder] = useState<DriverOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<AssignmentStatus | "">("");
  const [error, setError] = useState("");

  const endpoint = orderId ? `/api/driver/orders/${orderId}` : "/api/driver/orders";

  const load = useCallback(
    async (foreground = false) => {
      setError("");
      if (foreground) setRefreshing(true);

      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const result = (await response.json()) as ApiResult;

        if (!response.ok || !result.ok) {
          throw new Error(formatApiError(result, "Unable to load driver orders."));
        }

        if (orderId) {
          setOrder(result.data.order ?? null);
        } else {
          setDriver(result.data.driver ?? null);
          setOrders(result.data.orders ?? []);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load driver orders.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [endpoint, orderId],
  );

  useEffect(() => {
    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [load]);

  const visibleOrders = useMemo(
    () =>
      [...orders].sort((left, right) => {
        if (left.assignmentStatus === "DELIVERED" && right.assignmentStatus !== "DELIVERED") {
          return 1;
        }
        if (right.assignmentStatus === "DELIVERED" && left.assignmentStatus !== "DELIVERED") {
          return -1;
        }
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }),
    [orders],
  );

  const updateStatus = async (status: AssignmentStatus) => {
    if (!orderId || updating) return;
    setUpdating(status);
    setError("");

    try {
      const response = await fetch(`/api/driver/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.ok) {
        throw new Error(formatApiError(result, "Unable to update delivery status."));
      }

      setOrder(result.data.order ?? null);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Unable to update delivery status.",
      );
    } finally {
      setUpdating("");
    }
  };

  return (
    <section className="min-h-screen bg-[#F7F4ED] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            {orderId ? (
              <Link
                href="/driver/orders"
                className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-[#062F24]"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Orders
              </Link>
            ) : null}
            <p className="text-xs font-bold uppercase text-[#8A6D3F]">Driver</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight text-[#062F24]">
              {orderId ? "Delivery details" : driver?.name ?? "Assigned deliveries"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-button border border-[rgba(6,47,36,0.16)] bg-white px-4 py-3 text-sm font-extrabold text-[#062F24] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        {error ? (
          <p
            className="mb-5 rounded-surface border border-red-900/20 bg-red-900/10 px-4 py-3 text-sm font-semibold text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-surface border border-[rgba(6,47,36,0.1)] bg-white text-[#062F24]">
            <Loader2 size={22} className="animate-spin" aria-hidden="true" />
          </div>
        ) : orderId ? (
          order ? (
            <OrderDetail order={order} updating={updating} onStatusUpdate={updateStatus} />
          ) : (
            <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-8 text-[#062F24]">
              Assigned order not found.
            </div>
          )
        ) : visibleOrders.length > 0 ? (
          <div className="grid gap-4">
            {visibleOrders.map((driverOrder) => (
              <OrderSummaryCard key={driverOrder.id} order={driverOrder} />
            ))}
          </div>
        ) : (
          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-8 text-[#062F24]">
            No assigned deliveries.
          </div>
        )}
      </div>
    </section>
  );
}
