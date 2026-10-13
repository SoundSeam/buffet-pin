"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  ChefHat,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCw,
  Route,
  Truck,
  Volume2,
  X,
} from "lucide-react";

import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPanel,
  adminButtonClass,
  adminCompactButtonClass,
  adminDangerButtonStyle,
  adminPrimaryButtonStyle,
  adminQuietButtonStyle,
} from "@/components/admin/admin-page-ui";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";

type Order = {
  id: string;
  orderNumber: string;
  publicCode: string;
  paymentStatus: string;
  refundStatus: string;
  productionStatus: string;
  dispatchStatus: string;
  acceptanceDeadlineAt: string | null;
  estimatedReadyEndAt: string | null;
  estimatedDeliveryEndAt: string | null;
  promisedDeliveryEndAt: string | null;
  preparationExtendedMinutes: number;
  readyForDeliveryAt: string | null;
  createdAt: string;
  customer: { name: string; phone: string; email: string | null };
  deliveryAddress: null | {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postalCode: string | null;
    instructions: string | null;
  };
  totals: { totalCents: number; currency: string };
  customerNotes: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    specialInstructions: string | null;
    modifiers: Array<{ id: string; groupName: string; optionName: string }>;
  }>;
  printJobs: Array<{ purpose: string; status: string }>;
  deliveryRun: null | {
    id: string;
    runNumber: string;
    status: string;
    position: number;
    stopStatus: string;
    handedOffAt: string | null;
    driver: { id: string; name: string } | null;
    proof: { id: string; status: string; storedAt: string } | null;
  };
};

type Intake = {
  onlineOrderingEnabled: boolean;
  paused: boolean;
  pausedAt: string | null;
  pauseReason: string | null;
  missedAcceptanceCount: number;
  missedAcceptancePauseThreshold: number;
  acceptanceWindowMinutes: number;
};

type Recommendation = {
  zoneId: string;
  orderIds: string[];
  orderNumbers: string[];
  driver: { id: string; name: string };
  reasons: string[];
  routingStatus: "ROUTED" | "MANUAL_FALLBACK";
  routingIssue: string | null;
  instruction: string;
  explanation: string;
  waitMinutes: number;
  evidenceToken: string;
};

type Lane = "new" | "preparing" | "ready" | "handed";

const laneDefinitions: Array<{
  key: Lane;
  label: string;
  description: string;
  icon: typeof BellRing;
}> = [
  {
    key: "new",
    label: "New — respond now",
    description: "Accept or refuse before the deadline.",
    icon: BellRing,
  },
  {
    key: "preparing",
    label: "Preparing",
    description: "Kitchen work owned by the controller.",
    icon: ChefHat,
  },
  {
    key: "ready",
    label: "Ready for delivery",
    description: "Review the recommended departure.",
    icon: PackageCheck,
  },
  {
    key: "handed",
    label: "Handed to driver",
    description: "Ownership has left the restaurant.",
    icon: Truck,
  },
];

function laneFor(order: Order): Lane | null {
  if (order.productionStatus === "AWAITING_ACCEPTANCE") return "new";
  if (
    ["ACCEPTED", "PREPARING", "PACKING", "PACKED"].includes(
      order.productionStatus,
    )
  )
    return "preparing";
  if (
    order.productionStatus === "AT_DISPATCH_DESK" &&
    ["UNASSIGNED", "RUN_PLANNED", "READY_FOR_PICKUP"].includes(
      order.dispatchStatus,
    )
  )
    return "ready";
  if (["PICKED_UP", "EN_ROUTE", "DELIVERED"].includes(order.dispatchStatus))
    return "handed";
  return null;
}

function formatMoney(cents: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function countdown(deadline: string | null, now: number) {
  if (!deadline) return "Deadline unavailable";
  const seconds = Math.max(
    0,
    Math.ceil((new Date(deadline).getTime() - now) / 1000),
  );
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function address(order: Order) {
  if (!order.deliveryAddress) return "Delivery address unavailable";
  return [
    order.deliveryAddress.addressLine1,
    order.deliveryAddress.addressLine2,
    order.deliveryAddress.city,
    order.deliveryAddress.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function printConfirmed(order: Order) {
  return order.printJobs.some(
    (job) =>
      ["INITIAL", "FALLBACK"].includes(job.purpose) &&
      job.status === "PRINTED",
  );
}

function problem(order: Order) {
  if (["FAILED", "UNKNOWN"].includes(order.refundStatus))
    return "Refund needs manager review.";
  if (order.dispatchStatus === "EXCEPTION") return "Delivery exception.";
  if (
    order.paymentStatus === "PAID" &&
    order.productionStatus === "AWAITING_ACCEPTANCE" &&
    !printConfirmed(order)
  )
    return "Kitchen ticket is not confirmed. Do not start preparation.";
  return null;
}

async function apiRequest(url: string, payload: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok || !body.ok)
    throw new Error(
      body.error?.message ?? body.error?.code ?? "The action could not be completed.",
    );
  return body.data;
}

function OrderContents({ order }: { order: Order }) {
  return (
    <div className="mt-4 space-y-3 border-t border-[#062F24]/10 pt-4">
      <ul className="space-y-3">
        {order.items.map((item) => (
          <li key={item.id} className="text-sm text-[#062F24]">
            <strong>
              {item.quantity}× {item.name}
            </strong>
            {item.modifiers.map((modifier) => (
              <span
                key={modifier.id}
                className="mt-0.5 block text-xs text-[#062F24]/60"
              >
                {modifier.groupName}: {modifier.optionName}
              </span>
            ))}
            {item.specialInstructions ? (
              <span className="mt-1 block rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                {item.specialInstructions}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {order.customerNotes ? (
        <p className="rounded bg-amber-50 p-2 text-xs font-semibold text-amber-900">
          Customer note: {order.customerNotes}
        </p>
      ) : null}
      <div className="text-xs leading-relaxed text-[#062F24]/65">
        <strong className="text-[#062F24]">{order.customer.name}</strong>
        <br />
        {address(order)}
        {order.deliveryAddress?.instructions ? (
          <>
            <br />Drop-off: {order.deliveryAddress.instructions}
          </>
        ) : null}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  lane,
  now,
  busy,
  onAccept,
  onRefuse,
  onAddTime,
  onReady,
  onRecoverHandoff,
}: {
  order: Order;
  lane: Lane;
  now: number;
  busy: boolean;
  onAccept: () => void;
  onRefuse: () => void;
  onAddTime: () => void;
  onReady: () => void;
  onRecoverHandoff: () => void;
}) {
  const [expanded, setExpanded] = useState(lane === "new");
  const issue = problem(order);
  const responseExpired =
    lane === "new" &&
    Boolean(
      order.acceptanceDeadlineAt &&
        new Date(order.acceptanceDeadlineAt).getTime() <= now,
    );
  return (
    <AdminPanel as="article" className="p-4">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="flex items-start justify-between gap-3">
          <span>
            <strong className="block text-lg font-extrabold text-[#062F24]">
              {order.orderNumber}
            </strong>
            <span className="mt-1 block text-sm font-semibold text-[#062F24]/65">
              {order.customer.name} · {formatMoney(order.totals.totalCents, order.totals.currency)}
            </span>
          </span>
          {busy ? <Loader2 className="animate-spin" size={18} /> : null}
        </span>
      </button>

      {lane === "new" ? (
        <div className="mt-3 flex items-center gap-2 rounded-surface bg-red-50 px-3 py-2 font-mono text-xl font-black text-red-800">
          <Clock3 size={18} /> {countdown(order.acceptanceDeadlineAt, now)}
        </div>
      ) : null}
      {lane === "preparing" ? (
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#062F24]/55">
          Ready target {formatTime(order.estimatedReadyEndAt)}
          {order.preparationExtendedMinutes
            ? ` · +${order.preparationExtendedMinutes} min`
            : ""}
        </p>
      ) : null}
      {lane === "handed" && order.deliveryRun ? (
        <p className="mt-3 text-sm font-semibold text-[#062F24]/70">
          {order.deliveryRun.driver?.name ?? "Assigned driver"} · stop {order.deliveryRun.position} · {order.deliveryRun.stopStatus.toLowerCase().replaceAll("_", " ")}
        </p>
      ) : null}
      {lane === "ready" && order.deliveryRun?.status && ["APPROVED", "READY"].includes(order.deliveryRun.status) ? (
        <p className="mt-3 rounded-surface bg-amber-50 p-3 text-xs font-bold text-amber-950">
          Run {order.deliveryRun.runNumber} is planned with {order.deliveryRun.driver?.name ?? "the assigned driver"}; physical handoff is still required.
        </p>
      ) : null}

      {issue ? (
        <p className="mt-3 flex items-start gap-2 rounded-surface bg-amber-50 p-3 text-xs font-bold text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {issue}
        </p>
      ) : null}
      {expanded ? <OrderContents order={order} /> : null}

      {lane === "new" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={adminButtonClass}
            style={adminDangerButtonStyle}
            disabled={busy || responseExpired}
            onClick={onRefuse}
          >
            <X size={16} /> Refuse
          </button>
          <button
            type="button"
            className={adminButtonClass}
            style={adminPrimaryButtonStyle}
            disabled={busy || responseExpired || !printConfirmed(order)}
            onClick={onAccept}
          >
            <Check size={16} /> Accept
          </button>
        </div>
      ) : null}
      {lane === "preparing" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={adminButtonClass}
            style={adminQuietButtonStyle}
            disabled={busy}
            onClick={onAddTime}
          >
            <Clock3 size={16} /> Add time
          </button>
          <button
            type="button"
            className={adminButtonClass}
            style={adminPrimaryButtonStyle}
            disabled={busy}
            onClick={onReady}
          >
            <PackageCheck size={16} /> Ready for delivery
          </button>
        </div>
      ) : null}
      {lane === "ready" && order.deliveryRun && ["APPROVED", "READY"].includes(order.deliveryRun.status) ? (
        <button
          type="button"
          className={`${adminButtonClass} mt-4 w-full`}
          style={adminPrimaryButtonStyle}
          disabled={busy}
          onClick={onRecoverHandoff}
        >
          <Truck size={16} /> Confirm bags and finish dispatch
        </button>
      ) : null}
    </AdminPanel>
  );
}

export default function AdminOrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [intake, setIntake] = useState<Intake | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationIssue, setRecommendationIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [now, setNow] = useState(Date.now());
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [dismissedExpiredOrderIds, setDismissedExpiredOrderIds] = useState<
    Set<string>
  >(() => new Set());
  const [refusalOrder, setRefusalOrder] = useState<Order | null>(null);
  const [refusalReason, setRefusalReason] = useState("");
  const [refusalError, setRefusalError] = useState("");
  const alarmAudio = useRef<HTMLAudioElement | null>(null);
  const previewStopTimer = useRef<number | null>(null);

  const getAlarmAudio = useCallback(() => {
    if (!alarmAudio.current) {
      const audio = new Audio("/sounds/new-order-alarm.mp3");
      audio.preload = "auto";
      audio.volume = 1;
      alarmAudio.current = audio;
    }
    return alarmAudio.current;
  }, []);

  const load = useCallback(async (foreground = false) => {
    if (foreground) setRefreshing(true);
    try {
      const [ordersResponse, recommendationResponse] = await Promise.all([
        fetch("/api/admin/orders?limit=200", { cache: "no-store" }),
        fetch("/api/admin/routing/suggestions", { cache: "no-store" }),
      ]);
      const ordersBody = await ordersResponse.json();
      const recommendationBody = await recommendationResponse.json();
      if (!ordersResponse.ok || !ordersBody.ok)
        throw new Error("The controller queue could not be loaded.");
      setOrders(ordersBody.data.orders);
      setIntake(ordersBody.data.intake);
      if (recommendationResponse.ok && recommendationBody.ok) {
        setRecommendations(recommendationBody.data.recommendations);
        setRecommendationIssue(recommendationBody.data.issue);
      }
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load orders.");
    } finally {
      setLoading(false);
      if (foreground) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);
  useRealtimeInvalidation({
    tokenRequest: { scope: "admin" },
    onInvalidate: () => void load(false),
    fallbackIntervalMs: 7000,
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const lanes = useMemo(
    () =>
      Object.fromEntries(
        laneDefinitions.map(({ key }) => [
          key,
          orders
            .filter((order) => laneFor(order) === key)
            .sort((a, b) => {
              const aTime =
                key === "new"
                  ? new Date(a.acceptanceDeadlineAt ?? a.createdAt).getTime()
                  : new Date(a.createdAt).getTime();
              const bTime =
                key === "new"
                  ? new Date(b.acceptanceDeadlineAt ?? b.createdAt).getTime()
                  : new Date(b.createdAt).getTime();
              return aTime - bTime;
            }),
        ]),
      ) as Record<Lane, Order[]>,
    [orders],
  );
  useEffect(() => {
    const awaitingIds = new Set(lanes.new.map((order) => order.id));
    setDismissedExpiredOrderIds((current) => {
      const next = new Set(
        [...current].filter((orderId) => awaitingIds.has(orderId)),
      );
      return next.size === current.size ? current : next;
    });
  }, [lanes.new]);
  const alarmOrder =
    lanes.new.find(
      (order) =>
        order.id !== busyId && !dismissedExpiredOrderIds.has(order.id),
    ) ?? null;
  const alarmOrderId = alarmOrder?.id ?? null;
  const alarmOrderNumber = alarmOrder?.orderNumber ?? null;
  const alarmDeadlinePassed = Boolean(
    alarmOrder?.acceptanceDeadlineAt &&
      new Date(alarmOrder.acceptanceDeadlineAt).getTime() <= now,
  );

  const enableAlarm = async () => {
    const audio = getAlarmAudio();
    try {
      if (previewStopTimer.current !== null)
        window.clearTimeout(previewStopTimer.current);
      audio.loop = Boolean(alarmOrderId && !alarmDeadlinePassed);
      audio.currentTime = 0;
      await audio.play();
      setAlarmEnabled(true);
      if (!audio.loop) {
        previewStopTimer.current = window.setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
          previewStopTimer.current = null;
        }, 1500);
      }
      if ("Notification" in window && Notification.permission === "default")
        void Notification.requestPermission();
    } catch {
      audio.pause();
      setAlarmEnabled(false);
      setError(
        "The order alarm could not play. Check this device's media permissions and volume, then try again.",
      );
    }
  };

  useEffect(() => {
    if (
      !alarmEnabled ||
      !alarmOrderId ||
      !alarmOrderNumber ||
      alarmDeadlinePassed
    )
      return;
    if (previewStopTimer.current !== null) {
      window.clearTimeout(previewStopTimer.current);
      previewStopTimer.current = null;
    }
    const audio = getAlarmAudio();
    audio.loop = true;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      setAlarmEnabled(false);
      setError(
        "The order alarm was blocked. Press Enable order alarm and check this device's volume.",
      );
    });
    if ("Notification" in window && Notification.permission === "granted")
      new Notification(`New order ${alarmOrderNumber}`, {
        body: "Respond before the acceptance deadline.",
        requireInteraction: true,
      });
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [
    alarmDeadlinePassed,
    alarmEnabled,
    alarmOrderId,
    alarmOrderNumber,
    getAlarmAudio,
  ]);

  useEffect(
    () => () => {
      if (previewStopTimer.current !== null)
        window.clearTimeout(previewStopTimer.current);
      alarmAudio.current?.pause();
    },
    [],
  );

  const mutate = async (
    orderId: string,
    action: () => Promise<unknown>,
    message: string,
    onSuccess?: () => void,
  ) => {
    setBusyId(orderId);
    setError("");
    setSuccess("");
    try {
      await action();
      onSuccess?.();
      setSuccess(message);
      await load(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const accept = (order: Order) =>
    mutate(
      order.id,
      () => apiRequest(`/api/admin/orders/${order.id}/accept`, {}),
      `${order.orderNumber} is being prepared.`,
      () =>
        setOrders((current) =>
          current.map((candidate) =>
            candidate.id === order.id
              ? { ...candidate, productionStatus: "PREPARING" }
              : candidate,
          ),
        ),
    );
  const refuse = (order: Order) => {
    setRefusalOrder(order);
    setRefusalReason("");
    setRefusalError("");
  };
  const cancelRefusal = () => {
    setRefusalOrder(null);
    setRefusalReason("");
    setRefusalError("");
  };
  const confirmRefusal = () => {
    if (!refusalOrder) return;
    const reason = refusalReason.trim();
    if (!reason) {
      setRefusalError("Enter a reason before refusing the order.");
      return;
    }
    const order = refusalOrder;
    cancelRefusal();
    void mutate(
      order.id,
      () => apiRequest(`/api/admin/orders/${order.id}/reject`, { reason }),
      `${order.orderNumber} entered the refund workflow.`,
      () =>
        setOrders((current) =>
          current.map((candidate) =>
            candidate.id === order.id
              ? {
                  ...candidate,
                  productionStatus: "REJECTED",
                  dispatchStatus: "CANCELLED",
                  refundStatus:
                    candidate.refundStatus === "NOT_REQUIRED"
                      ? "REQUIRED"
                      : candidate.refundStatus,
                }
              : candidate,
          ),
        ),
    );
  };
  const dismissExpiredOrder = (order: Order) => {
    const deadline = order.acceptanceDeadlineAt
      ? new Date(order.acceptanceDeadlineAt).getTime()
      : Number.POSITIVE_INFINITY;
    if (deadline > Date.now()) return;
    setDismissedExpiredOrderIds((current) => {
      const next = new Set(current);
      next.add(order.id);
      return next;
    });
    void load(false);
  };
  const addTime = (order: Order) => {
    const raw = window.prompt("Add 5, 10, or 15 minutes", "5");
    const minutes = Number(raw);
    if (![5, 10, 15].includes(minutes)) return;
    const reason = window.prompt("Why is more preparation time needed?");
    if (!reason?.trim()) return;
    void mutate(
      order.id,
      () =>
        apiRequest(`/api/admin/orders/${order.id}/production`, {
          action: "add_time",
          minutes,
          reason,
          requestKey: crypto.randomUUID(),
        }),
      `${minutes} minutes added to ${order.orderNumber}.`,
    );
  };
  const ready = (order: Order) => {
    if (
      !window.confirm(
        `Confirm every item, modifier, instruction, and the ${order.orderNumber} bag/ticket number are correct.`,
      )
    )
      return;
    void mutate(
      order.id,
      () =>
        apiRequest(`/api/admin/orders/${order.id}/production`, {
          action: "ready",
          orderNumberConfirmed: true,
        }),
      `${order.orderNumber} is ready for delivery.`,
    );
  };
  const recoverHandoff = (order: Order) => {
    if (!order.deliveryRun) return;
    if (
      !window.confirm(
        `Confirm the driver is present and every bag in ${order.deliveryRun.runNumber} has been physically handed over.`,
      )
    )
      return;
    void mutate(
      order.id,
      () =>
        apiRequest(`/api/admin/runs/${order.deliveryRun!.id}/handoff`, {
          bagsConfirmed: true,
        }),
      `${order.deliveryRun.runNumber} dispatched.`,
    );
  };
  const dispatch = (recommendation: Recommendation) => {
    if (
      !window.confirm(
        `Driver ${recommendation.driver.name} is present. Confirm physical handoff of: ${recommendation.orderNumbers.join(", ")}.`,
      )
    )
      return;
    const busyKey = recommendation.orderIds.join(":");
    void mutate(
      busyKey,
      () =>
        apiRequest("/api/admin/runs/handoff", {
          requestKey: crypto.randomUUID(),
          driverId: recommendation.driver.id,
          orderIds: recommendation.orderIds,
          evidenceToken: recommendation.evidenceToken,
          bagsConfirmed: true,
        }),
      `${recommendation.orderNumbers.join(", ")} handed to ${recommendation.driver.name}.`,
    );
  };
  const resume = async () => {
    const reason = window.prompt("Why is the restaurant ready to receive orders again?");
    if (!reason?.trim()) return;
    try {
      await apiRequest("/api/admin/order-intake/resume", { reason });
      setSuccess("Order intake resumed.");
      await load(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to resume intake.");
    }
  };

  return (
    <AdminPage>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-[#062F24]">
            Kitchen Controller
          </h1>
          <p className="mt-1 text-sm text-[#062F24]/65">
            One queue from paid order to physical driver handoff.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={adminButtonClass}
            style={alarmEnabled ? adminQuietButtonStyle : adminPrimaryButtonStyle}
            onClick={() => void enableAlarm()}
          >
            <Volume2 size={16} />
            {alarmEnabled ? "Alarm ready" : "Enable order alarm"}
          </button>
          <button
            type="button"
            aria-label="Refresh controller queue"
            className={adminButtonClass}
            style={adminQuietButtonStyle}
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            {refreshing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {!alarmEnabled ? (
        <AdminNotice tone="warning" className="mt-6">
          Sound is not armed. Press “Enable order alarm” on this device before service.
        </AdminNotice>
      ) : null}
      {intake?.paused ? (
        <AdminNotice tone="error" className="mt-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <span>
              <strong>New order intake is paused.</strong> The restaurant missed {intake.missedAcceptanceCount} consecutive response deadlines.
            </span>
            <button
              type="button"
              className={adminCompactButtonClass}
              style={adminQuietButtonStyle}
              onClick={() => void resume()}
            >
              Resume intake
            </button>
          </div>
        </AdminNotice>
      ) : null}
      {error || success ? (
        <AdminNotice tone={error ? "error" : "success"} className="mt-6" role="status">
          {error || success}
        </AdminNotice>
      ) : null}

      {loading ? (
        <div className="mt-10 flex items-center gap-3 text-sm font-semibold text-[#062F24]/65">
          <Loader2 className="animate-spin" size={18} /> Loading controller queue
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-5 xl:grid-cols-4" data-controller-board>
          {laneDefinitions.map(({ key, label, description, icon: Icon }) => (
            <section key={key} aria-labelledby={`lane-${key}`} className="min-w-0">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 id={`lane-${key}`} className="flex items-center gap-2 text-sm font-extrabold text-[#062F24]">
                    <Icon size={17} /> {label}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#062F24]/55">
                    {description}
                  </p>
                </div>
                <span className="rounded-full bg-[#062F24]/8 px-2.5 py-1 text-xs font-black text-[#062F24]">
                  {lanes[key].length}
                </span>
              </div>

              {key === "ready" && recommendations.length > 0 ? (
                <div className="mb-4 space-y-3">
                  {recommendations.slice(0, 3).map((recommendation) => {
                    const busyKey = recommendation.orderIds.join(":");
                    return (
                      <article key={`${recommendation.driver.id}:${busyKey}`} className="rounded-surface-lg border-2 border-[#062F24] bg-[#F3F8F5] p-4">
                        <p className="flex items-center gap-2 text-sm font-extrabold text-[#062F24]">
                          <Route size={16} /> {recommendation.instruction}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-[#062F24]/70">
                          {recommendation.orderNumbers.join(" → ")}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-[#062F24]/55">
                          {recommendation.routingStatus === "ROUTED"
                            ? "Stop order checked by routing."
                            : "Routing unavailable; verify the displayed order manually."}
                        </p>
                        <button
                          type="button"
                          className={`${adminButtonClass} mt-4 w-full`}
                          style={adminPrimaryButtonStyle}
                          disabled={busyId === busyKey}
                          onClick={() => dispatch(recommendation)}
                        >
                          {busyId === busyKey ? <Loader2 className="animate-spin" size={16} /> : <Truck size={16} />}
                          Confirm bags and dispatch
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : null}
              {key === "ready" && recommendationIssue ? (
                <p className="mb-4 rounded-surface bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                  {recommendationIssue}
                </p>
              ) : null}

              <div className="space-y-3">
                {lanes[key].map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    lane={key}
                    now={now}
                    busy={busyId === order.id}
                    onAccept={() => void accept(order)}
                    onRefuse={() => refuse(order)}
                    onAddTime={() => addTime(order)}
                    onReady={() => ready(order)}
                    onRecoverHandoff={() => recoverHandoff(order)}
                  />
                ))}
                {lanes[key].length === 0 ? (
                  <AdminEmptyState>Nothing in this lane.</AdminEmptyState>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}

      {alarmOrder && !refusalOrder ? (
        <div
          className={`fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4 ${
            alarmDeadlinePassed ? "bg-[#041F18]/80" : "bg-[#041F18]/95"
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="incoming-order-title"
        >
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl sm:p-10">
            <div
              className={`flex items-center gap-3 ${
                alarmDeadlinePassed ? "text-amber-800" : "text-red-700"
              }`}
            >
              {alarmDeadlinePassed ? (
                <AlertTriangle size={32} />
              ) : (
                <Bell className="animate-pulse" size={32} />
              )}
              <p className="text-sm font-black uppercase tracking-[0.14em]">
                {alarmDeadlinePassed
                  ? "Response window missed"
                  : "Paid order — respond now"}
              </p>
            </div>
            <h2 id="incoming-order-title" className="mt-4 text-4xl font-black text-[#062F24] sm:text-5xl">
              {alarmOrder.orderNumber}
            </h2>
            <p className="mt-3 text-xl font-semibold text-[#062F24]/70">
              {alarmOrder.customer.name} · {formatMoney(alarmOrder.totals.totalCents, alarmOrder.totals.currency)}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-red-50 p-5 font-mono text-5xl font-black text-red-800">
              <Clock3 size={34} /> {countdown(alarmOrder.acceptanceDeadlineAt, now)}
            </div>
            {alarmDeadlinePassed ? (
              <p className="mt-4 rounded-xl bg-red-50 p-4 font-bold text-red-900">
                The response window ended. The server is cancelling and entering the refund workflow; wait for the queue to refresh.
              </p>
            ) : null}
            {!alarmEnabled && !alarmDeadlinePassed ? (
              <button
                type="button"
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-700 bg-amber-50 px-4 font-extrabold text-amber-950"
                onClick={() => void enableAlarm()}
              >
                <Volume2 size={19} /> Enable sound on this device
              </button>
            ) : null}
            <OrderContents order={alarmOrder} />
            {problem(alarmOrder) ? (
              <p className="mt-5 rounded-xl bg-amber-50 p-4 font-bold text-amber-950">
                {problem(alarmOrder)}
              </p>
            ) : null}
            {alarmDeadlinePassed ? (
              <button
                type="button"
                className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-button bg-[#062F24] px-5 text-lg font-extrabold text-white"
                onClick={() => dismissExpiredOrder(alarmOrder)}
              >
                Close
              </button>
            ) : (
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="inline-flex min-h-16 items-center justify-center gap-2 rounded-button border-2 border-red-800 px-5 text-lg font-extrabold text-red-800 disabled:opacity-40"
                  disabled={busyId === alarmOrder.id}
                  onClick={() => refuse(alarmOrder)}
                >
                  <X size={22} /> Refuse
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-16 items-center justify-center gap-2 rounded-button bg-[#062F24] px-5 text-lg font-extrabold text-white disabled:opacity-40"
                  disabled={
                    busyId === alarmOrder.id || !printConfirmed(alarmOrder)
                  }
                  onClick={() => void accept(alarmOrder)}
                >
                  <Check size={22} /> Accept
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {refusalOrder ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-[#041F18]/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refuse-order-title"
          aria-describedby="refuse-order-description"
        >
          <form
            className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              confirmRefusal();
            }}
          >
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle size={28} />
              <p className="text-sm font-black uppercase tracking-[0.14em]">
                Confirm refusal
              </p>
            </div>
            <h2
              id="refuse-order-title"
              className="mt-4 text-3xl font-black text-[#062F24]"
            >
              Refuse {refusalOrder.orderNumber}?
            </h2>
            <p
              id="refuse-order-description"
              className="mt-3 text-base font-semibold leading-7 text-[#062F24]/75"
            >
              This cancels the order and starts the required refund workflow.
              This action cannot be undone from the Kitchen Controller.
            </p>
            <label
              className="mt-6 block text-sm font-extrabold text-[#062F24]"
              htmlFor="refusal-reason"
            >
              Reason for refusing
            </label>
            <textarea
              id="refusal-reason"
              autoFocus
              rows={4}
              value={refusalReason}
              onChange={(event) => {
                setRefusalReason(event.target.value);
                if (refusalError) setRefusalError("");
              }}
              className="mt-2 w-full rounded-xl border-2 border-[#062F24]/20 px-4 py-3 text-base text-[#062F24] outline-none focus:border-[#062F24]"
              placeholder="Tell the team why this order cannot be fulfilled"
            />
            {refusalError ? (
              <p className="mt-2 text-sm font-bold text-red-800" role="alert">
                {refusalError}
              </p>
            ) : null}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="inline-flex min-h-14 items-center justify-center rounded-button border-2 border-[#062F24]/25 px-5 font-extrabold text-[#062F24]"
                onClick={cancelRefusal}
              >
                Keep order
              </button>
              <button
                type="submit"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-button bg-red-800 px-5 font-extrabold text-white disabled:opacity-40"
                disabled={busyId === refusalOrder.id}
              >
                <X size={19} /> Refuse
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AdminPage>
  );
}
