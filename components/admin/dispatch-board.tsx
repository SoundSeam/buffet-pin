"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, MapPinned, Route, ShieldCheck, X } from "lucide-react";

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
  adminDangerButtonStyle,
  adminFieldClass,
  adminLabelClass,
  adminPrimaryButtonStyle,
  adminQuietButtonStyle,
} from "@/components/admin/admin-page-ui";
type Order = {
  id: string;
  orderNumber: string;
  productionStatus: string;
  dispatchStatus: string;
};
type Driver = { id: string; name: string };
type Run = {
  id: string;
  runNumber: string;
  status: string;
  driverId: string | null;
  stops: Array<{
    orderId: string;
    status: string;
    order: { orderNumber: string };
  }>;
};
type Suggestion = {
  zoneId: string;
  orderIds: string[];
  reasons: string[];
  routingStatus: "ROUTED" | "MANUAL_FALLBACK";
  durationSeconds: number | null;
  distanceMeters: number | null;
  routingIssue: string | null;
  explanation: string;
  evidenceToken: string;
};
export default function DispatchBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [driverId, setDriverId] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [routePlan, setRoutePlan] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const [ordersResponse, runsResponse] = await Promise.all([
      fetch("/api/admin/orders?limit=200", { cache: "no-store" }),
      fetch("/api/admin/runs", { cache: "no-store" }),
    ]);
    const orderBody = await ordersResponse.json();
    const runBody = await runsResponse.json();
    if (!ordersResponse.ok || !runsResponse.ok)
      throw new Error("Unable to load dispatch state.");
    setOrders(orderBody.data.orders);
    setDrivers(orderBody.data.drivers);
    setRuns(runBody.data.runs);
  }, []);
  useEffect(() => {
    void load().catch((caught) => setError(String(caught)));
  }, [load]);
  useEffect(() => {
    setSuggestions([]);
    setRoutePlan(null);
    if (!driverId) return;
    void fetch(
      `/api/admin/routing/suggestions?driverId=${encodeURIComponent(driverId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error?.message ?? "Unable to load suggestions.");
        setSuggestions(body.data.suggestions);
      })
      .catch((caught) => setError(String(caught)));
  }, [driverId]);
  const request = async (url: string, method: string, payload?: object) => {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(
        body.error?.message ?? body.error?.code ?? "Dispatch action failed.",
      );
    await load();
  };
  const ready = orders.filter(
    (order) =>
      order.productionStatus === "AT_DISPATCH_DESK" &&
      order.dispatchStatus === "UNASSIGNED",
  );
  const activeRuns = runs.filter(
    (run) => !["COMPLETED", "CANCELLED"].includes(run.status),
  );
  return (
    <AdminPage>
      <AdminPageHeader
        title="Dispatch runs"
        description="Choose one to four desk-ready bags. Same-zone and driver eligibility are enforced by the server."
      />
      {error ? (
        <AdminNotice tone="error" role="alert" className="mt-6">
          {error}
        </AdminNotice>
      ) : null}
      <AdminPanel className="mt-8">
        <AdminSectionHeading
          title="Create run"
          description={`${selected.length} of 4 bags selected. Choose a driver before approving the run.`}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {ready.map((order) => (
            <label
              key={order.id}
              className="flex items-center justify-between gap-4 rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] px-4 py-3 text-sm font-semibold text-[#062F24]"
            >
              <span>{order.orderNumber}</span>
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={selected.includes(order.id)}
                disabled={!selected.includes(order.id) && selected.length >= 4}
                onChange={(event) => {
                  setRoutePlan(null);
                  setSelected((value) =>
                    event.target.checked
                      ? [...value, order.id]
                      : value.filter((id) => id !== order.id),
                  );
                }}
              />
            </label>
          ))}
        </div>
        {ready.length === 0 ? (
          <div className="mt-4">
            <AdminEmptyState>
              No desk-ready bags are waiting for dispatch.
            </AdminEmptyState>
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid w-full gap-2 sm:max-w-sm">
            <span className={adminLabelClass}>Driver</span>
            <select
              className={adminFieldClass}
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="">Select driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={adminButtonClass}
            style={adminPrimaryButtonStyle}
            disabled={!driverId || selected.length === 0}
            onClick={() =>
              void request("/api/admin/runs", "POST", {
                requestKey: crypto.randomUUID(),
                orderIds: selected,
                driverId,
                routePlan: routePlan
                  ? {
                      evidenceToken: routePlan.evidenceToken,
                    }
                  : undefined,
              })
                .then(() => {
                  setSelected([]);
                  setRoutePlan(null);
                })
                .catch((caught) => setError(String(caught)))
            }
          >
            <Route size={14} />
            Approve run
          </button>
        </div>
        {driverId && (
          <div className="mt-6 border-t border-[#062F24]/10 pt-6">
            <h3 className="text-sm font-extrabold text-[#062F24]">
              Explainable suggestions
            </h3>
            {suggestions.length === 0 ? (
              <p className="mt-2 text-sm text-[#062F24]/65">
                No batch has reached a release condition yet.
              </p>
            ) : (
              <div className="mt-3 grid gap-3">
                {suggestions.map((suggestion) => (
                  <article
                    key={`${suggestion.zoneId}:${suggestion.orderIds.join(",")}`}
                    className="rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-[#062F24]">
                        Zone {suggestion.zoneId} · {suggestion.orderIds.length}{" "}
                        stop(s)
                      </strong>
                      <AdminStatusPill>
                        {suggestion.routingStatus}
                      </AdminStatusPill>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#062F24]/65">
                      {suggestion.explanation}
                    </p>
                    {suggestion.routingIssue && (
                      <p className="mt-2 text-sm text-amber-800">
                        {suggestion.routingIssue}
                      </p>
                    )}
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#062F24]/45">
                      Estimate: {suggestion.durationSeconds ?? "manual"} sec /{" "}
                      {suggestion.distanceMeters ?? "manual"} m
                    </p>
                    <button
                      type="button"
                      className={`${adminCompactButtonClass} mt-3`}
                      style={adminQuietButtonStyle}
                      onClick={() => {
                        setSelected(suggestion.orderIds);
                        setRoutePlan(suggestion);
                      }}
                    >
                      <MapPinned size={14} />
                      Use this suggestion
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </AdminPanel>
      <section className="mt-8">
        <AdminSectionHeading
          title={`Active runs (${activeRuns.length})`}
          description="Verify each bag before pickup and keep exceptions visible until every returned bag is physically back at the desk."
        />
        <div className="mt-4 grid gap-4">
          {activeRuns.map((run) => (
            <AdminPanel key={run.id} as="article">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-lg font-extrabold text-[#062F24]">
                    {run.runNumber}
                  </h2>
                  <div className="mt-2">
                    <AdminStatusPill>{run.status}</AdminStatusPill>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {run.status === "EXCEPTION" && (
                    <button
                      type="button"
                      className={adminCompactButtonClass}
                      style={adminQuietButtonStyle}
                      onClick={() =>
                        void request(`/api/admin/runs/${run.id}`, "PATCH", {
                          action: "RESOLVE_EXCEPTION",
                          reason:
                            "Dispatcher verified all failed bags returned to the dispatch desk",
                        }).catch((caught) => setError(String(caught)))
                      }
                    >
                      <ShieldCheck size={14} />
                      Close exception
                    </button>
                  )}
                  <button
                    type="button"
                    className={adminCompactButtonClass}
                    style={adminDangerButtonStyle}
                    disabled={
                      !["DRAFT", "APPROVED", "READY"].includes(run.status)
                    }
                    onClick={() =>
                      void request(`/api/admin/runs/${run.id}`, "PATCH", {
                        action: "CANCEL",
                        reason: "Dispatcher cancelled before pickup",
                      }).catch((caught) => setError(String(caught)))
                    }
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              </div>
              <ul className="mt-5 divide-y divide-[#062F24]/10 overflow-hidden rounded-surface border border-[#062F24]/10">
                {run.stops.map((stop) => (
                  <li
                    key={stop.orderId}
                    className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-[#062F24]">
                        {stop.order.orderNumber}
                      </strong>
                      <AdminStatusPill>{stop.status}</AdminStatusPill>
                    </span>
                    {stop.status === "FAILED" ? (
                      <button
                        type="button"
                        className={adminCompactButtonClass}
                        style={adminQuietButtonStyle}
                        onClick={() =>
                          void request(`/api/admin/runs/${run.id}`, "PATCH", {
                            action: "RETURN_TO_DESK",
                            orderId: stop.orderId,
                            reason:
                              "Dispatcher physically received and verified the returned bag",
                          }).catch((caught) => setError(String(caught)))
                        }
                      >
                        Confirm returned to desk
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={stop.status !== "PLANNED"}
                        className={adminCompactButtonClass}
                        style={adminQuietButtonStyle}
                        onClick={() =>
                          void request(
                            `/api/admin/runs/${run.id}/bags`,
                            "POST",
                            {
                              orderId: stop.orderId,
                            },
                          ).catch((caught) => setError(String(caught)))
                        }
                      >
                        {stop.status !== "PLANNED" ? <Check size={14} /> : null}
                        Verify bag
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </AdminPanel>
          ))}
          {activeRuns.length === 0 ? (
            <AdminEmptyState>
              No delivery runs are currently active.
            </AdminEmptyState>
          ) : null}
        </div>
      </section>
    </AdminPage>
  );
}
