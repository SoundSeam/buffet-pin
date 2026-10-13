"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";

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
  adminPrimaryButtonStyle,
  adminQuietButtonStyle,
} from "@/components/admin/admin-page-ui";

type Alert = {
  id: string;
  category: string;
  severity: string;
  status: string;
  summary: string;
  orderNumber: string | null;
  entityId: string | null;
  entityType: string | null;
};
type PrintJob = {
  id: string;
  purpose: string;
  status: string;
  order: { orderNumber: string; paymentStatus: string };
};
type RefundIntent = {
  id: string;
  status: string;
  amountCents: number;
  lastErrorMessage: string | null;
  order: { orderNumber: string };
  payment: { providerPaymentId: string | null };
};
type ExternalOrder = {
  id: string;
  state: string;
  providerOrderId: string | null;
  order: { orderNumber: string; paymentStatus: string };
};

export default function OperationsConsole({
  canManageRefunds = true,
}: {
  canManageRefunds?: boolean;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [refunds, setRefunds] = useState<RefundIntent[]>([]);
  const [externalOrders, setExternalOrders] = useState<ExternalOrder[]>([]);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch("/api/admin/alerts", { cache: "no-store" }),
      fetch("/api/admin/print-jobs", { cache: "no-store" }),
      fetch("/api/admin/refunds", { cache: "no-store" }),
      fetch("/api/admin/clover/orders/resolve", { cache: "no-store" }),
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );
    if (responses.some((response) => !response.ok))
      throw new Error("Unable to load one or more operational queues.");
    setAlerts(bodies[0].data.alerts);
    setJobs(bodies[1].data.jobs);
    setRefunds(bodies[2].data.intents);
    setExternalOrders(bodies[3].data.externalOrders);
    setLoaded(true);
  }, []);
  useEffect(() => {
    void load().catch((error) => {
      setLoaded(true);
      setMessage(String(error));
    });
  }, [load]);
  const request = async (url: string, method: string, body: object) => {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error?.message ?? result.error?.code ?? "Action failed.",
      );
    await load();
  };
  const acknowledge = (alert: Alert) => {
    const note = window.prompt("Acknowledgement and owner/next action");
    if (note?.trim())
      void request(`/api/admin/alerts/${alert.id}`, "PATCH", {
        action: "ACKNOWLEDGE",
        note,
      }).catch((error) => setMessage(String(error)));
  };
  const resolveRefund = (intent: RefundIntent) => {
    const providerRefundId = window.prompt(
      "Confirmed Clover refund ID (cancel if not confirmed)",
    );
    if (!providerRefundId?.trim()) return;
    const reason = window.prompt("Evidence/reconciliation note");
    if (reason?.trim())
      void request(`/api/admin/refunds/${intent.id}/resolve`, "POST", {
        succeeded: true,
        providerRefundId,
        reason,
      }).catch((error) => setMessage(String(error)));
  };
  const reconcileNotification = (alert: Alert) => {
    if (!alert.entityId) return;
    if (!alert.summary.includes("UNKNOWN")) {
      const reason = window.prompt(
        "Retry reason after correcting the deterministic notification failure",
      );
      if (reason?.trim())
        void request(`/api/admin/notifications/${alert.entityId}`, "PATCH", {
          action: "RETRY",
          reason,
          requestKey: crypto.randomUUID(),
        }).catch((error) => setMessage(String(error)));
      return;
    }
    const outcome = window
      .prompt(
        "Twilio evidence outcome: sent, failed, or replace (replace only after confirming Twilio did not accept it)",
      )
      ?.trim()
      .toLowerCase();
    if (!outcome || !["sent", "failed", "replace"].includes(outcome)) return;
    const reason = window.prompt(
      "Required Twilio evidence / manager attestation note",
    );
    if (!reason?.trim()) return;
    if (outcome === "sent") {
      const providerMessageId = window.prompt("Confirmed Twilio message SID");
      if (!providerMessageId?.trim()) return;
      void request(`/api/admin/notifications/${alert.entityId}`, "PATCH", {
        action: "RECONCILE_SENT",
        providerMessageId,
        reason,
      }).catch((error) => setMessage(String(error)));
      return;
    }
    void request(
      `/api/admin/notifications/${alert.entityId}`,
      "PATCH",
      outcome === "failed"
        ? { action: "RECONCILE_FAILED", reason }
        : {
            action: "REPLACE_UNKNOWN",
            reason,
            requestKey: crypto.randomUUID(),
          },
    ).catch((error) => setMessage(String(error)));
  };
  const recoverExternalOrder = (externalOrder: ExternalOrder) => {
    if (externalOrder.state === "FAILED") {
      const reason = window.prompt(
        "Confirm this unpaid failed checkout is abandoned and the customer must start a new checkout (reason required)",
      );
      if (reason?.trim())
        void request("/api/admin/clover/orders/resolve", "POST", {
          action: "ABANDON_FAILED",
          externalOrderId: externalOrder.id,
          reason,
        }).catch((error) => setMessage(String(error)));
      return;
    }
    if (externalOrder.state !== "UNKNOWN") return;
    const outcome = window
      .prompt("Clover reconciliation outcome: created or not-created")
      ?.trim()
      .toLowerCase();
    if (!outcome || !["created", "not-created"].includes(outcome)) return;
    const evidence = window.prompt(
      "Evidence note, timestamp, and operator reference",
    );
    if (!evidence?.trim()) return;
    if (outcome === "not-created") {
      const verificationMethod = window
        .prompt("Verification source: dashboard or support")
        ?.trim()
        .toLowerCase();
      if (
        !verificationMethod ||
        !["dashboard", "support"].includes(verificationMethod)
      )
        return;
      void request("/api/admin/clover/orders/resolve", "POST", {
        action: "RECONCILE_NOT_CREATED",
        externalOrderId: externalOrder.id,
        evidence: {
          verificationMethod:
            verificationMethod === "dashboard"
              ? "CLOVER_DASHBOARD"
              : "CLOVER_SUPPORT",
          observedAt: new Date().toISOString(),
          note: evidence,
        },
      }).catch((error) => setMessage(String(error)));
      return;
    }
    const providerOrderId = window.prompt("Confirmed Clover order ID");
    if (providerOrderId?.trim())
      void request("/api/admin/clover/orders/resolve", "POST", {
        action: "RESOLVE_CREATED",
        externalOrderId: externalOrder.id,
        providerOrderId,
        evidence: {
          verificationMethod: "CLOVER_API",
          observedAt: new Date().toISOString(),
          note: evidence,
        },
      }).catch((error) => setMessage(String(error)));
  };
  return (
    <AdminPage>
      <AdminPageHeader
        title="Problems and recovery"
        description="What system problem needs technical action? Source evidence remains authoritative; unknown external outcomes are never retried blindly."
        actions={
          <button
            type="button"
            className={adminButtonClass}
            style={adminQuietButtonStyle}
            onClick={() => void load()}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />
      {message ? (
        <AdminNotice tone="warning" className="mt-6">
          {message}
        </AdminNotice>
      ) : null}
      {loaded &&
      !message &&
      alerts.length === 0 &&
      jobs.length === 0 &&
      refunds.length === 0 &&
      externalOrders.length === 0 ? (
        <div className="mt-8">
          <AdminEmptyState>No technical recovery is waiting.</AdminEmptyState>
        </div>
      ) : null}
      <AdminPanel className="mt-8">
        <AdminSectionHeading
          title={`Open alerts (${alerts.length})`}
          description="Acknowledge ownership here, then resolve the underlying operational source."
        />
        <div className="mt-4 grid gap-3">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className="flex flex-col justify-between gap-4 rounded-surface border border-[#062F24]/10 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-[#062F24]">
                    {alert.orderNumber ?? alert.category}
                  </strong>
                  <AdminStatusPill>{alert.severity}</AdminStatusPill>
                  <AdminStatusPill>{alert.category}</AdminStatusPill>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#062F24]/65">
                  {alert.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {alert.category === "NOTIFICATION_FAILED" &&
                alert.entityType === "Notification" ? (
                  <button
                    type="button"
                    className={adminCompactButtonClass}
                    style={adminQuietButtonStyle}
                    onClick={() => reconcileNotification(alert)}
                  >
                    <RotateCcw size={14} />
                    Reconcile
                  </button>
                ) : null}
                <button
                  type="button"
                  className={adminCompactButtonClass}
                  style={adminPrimaryButtonStyle}
                  onClick={() => acknowledge(alert)}
                >
                  <ShieldCheck size={14} />
                  {alert.status === "ACKNOWLEDGED"
                    ? "Update acknowledgement"
                    : "Acknowledge"}
                </button>
              </div>
            </article>
          ))}
          {alerts.length === 0 ? (
            <AdminEmptyState>No operational alerts are open.</AdminEmptyState>
          ) : null}
        </div>
      </AdminPanel>
      <AdminPanel className="mt-6">
        <AdminSectionHeading
          title={`Clover order recovery (${externalOrders.length})`}
          description="Record verified provider outcomes before retrying or abandoning an ambiguous checkout."
        />
        <div className="mt-4 grid gap-3">
          {externalOrders.map((externalOrder) => (
            <article
              key={externalOrder.id}
              className="flex flex-col justify-between gap-4 rounded-surface border border-[#062F24]/10 p-4 sm:flex-row sm:items-center"
            >
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-[#062F24]">
                  {externalOrder.order.orderNumber}
                </strong>
                <AdminStatusPill>{externalOrder.state}</AdminStatusPill>
              </span>
              <button
                type="button"
                className={adminCompactButtonClass}
                style={adminQuietButtonStyle}
                disabled={externalOrder.state === "TOTAL_MISMATCH"}
                onClick={() => recoverExternalOrder(externalOrder)}
              >
                {externalOrder.state === "FAILED"
                  ? "Abandon unpaid checkout"
                  : externalOrder.state === "TOTAL_MISMATCH"
                    ? "Resolve in Clover/support"
                    : "Record reconciled order"}
              </button>
            </article>
          ))}
          {externalOrders.length === 0 ? (
            <AdminEmptyState>
              No Clover orders require recovery.
            </AdminEmptyState>
          ) : null}
        </div>
      </AdminPanel>
      <AdminPanel className="mt-6">
        <AdminSectionHeading
          title={`Print queue (${jobs.length})`}
          description="Observe ambiguous print outcomes before authorizing any replacement action."
        />
        <div className="mt-4 grid gap-3">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="flex flex-col justify-between gap-4 rounded-surface border border-[#062F24]/10 p-4 sm:flex-row sm:items-center"
            >
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-[#062F24]">
                  {job.order.orderNumber}
                </strong>
                <AdminStatusPill>{job.purpose}</AdminStatusPill>
                <AdminStatusPill>{job.status}</AdminStatusPill>
              </span>
              {job.purpose === "INITIAL" && (
                <button
                  type="button"
                  className={adminCompactButtonClass}
                  style={adminQuietButtonStyle}
                  disabled={
                    !["PENDING", "SUBMITTED", "PRINTING", "FAILED"].includes(
                      job.status,
                    )
                  }
                  onClick={() =>
                    void (async () => {
                      if (job.status === "FAILED") {
                        const reason = window.prompt(
                          "Retry reason after correcting the deterministic Clover rejection",
                        );
                        if (!reason?.trim()) return;
                        await request("/api/admin/print-jobs", "POST", {
                          jobId: job.id,
                          action: "retry_failed",
                          reason,
                        });
                        return;
                      }
                      await request("/api/admin/print-jobs", "POST", {
                        jobId: job.id,
                        action: job.status === "PENDING" ? "submit" : "observe",
                      });
                    })().catch((error) => setMessage(String(error)))
                  }
                >
                  {job.status === "PENDING"
                    ? "Submit"
                    : job.status === "FAILED"
                      ? "Authorize retry"
                      : "Observe"}
                </button>
              )}
            </article>
          ))}
          {jobs.length === 0 ? (
            <AdminEmptyState>No print jobs require attention.</AdminEmptyState>
          ) : null}
        </div>
      </AdminPanel>
      <AdminPanel className="mt-6">
        <AdminSectionHeading
          title={`Refund review (${refunds.length})`}
          description="Submit durable pending requests or record confirmed Clover evidence for ambiguous outcomes."
        />
        <div className="mt-4 grid gap-3">
          {refunds.map((intent) => (
            <article
              key={intent.id}
              className="flex flex-col justify-between gap-4 rounded-surface border border-[#062F24]/10 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-[#062F24]">
                    {intent.order.orderNumber} · $
                    {(intent.amountCents / 100).toFixed(2)} CAD
                  </strong>
                  <AdminStatusPill>{intent.status}</AdminStatusPill>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#062F24]/65">
                  {intent.lastErrorMessage ??
                    (intent.status === "PENDING"
                      ? "Durable request is staged and has not reached Clover."
                      : "Manual provider reconciliation required.")}
                </p>
              </div>
              {!canManageRefunds ? (
                <p className="text-xs font-semibold text-amber-800">
                  A manager must authorize any refund decision.
                </p>
              ) : intent.status === "PENDING" ? (
                <button
                  type="button"
                  className={adminCompactButtonClass}
                  style={adminPrimaryButtonStyle}
                  onClick={() =>
                    void request(
                      `/api/admin/refunds/${intent.id}/submit`,
                      "POST",
                      {},
                    ).catch((error) => setMessage(String(error)))
                  }
                >
                  Submit staged refund
                </button>
              ) : (
                <button
                  type="button"
                  className={adminCompactButtonClass}
                  style={adminQuietButtonStyle}
                  onClick={() => resolveRefund(intent)}
                >
                  Record confirmed success
                </button>
              )}
            </article>
          ))}
          {refunds.length === 0 ? (
            <AdminEmptyState>No refunds require review.</AdminEmptyState>
          ) : null}
        </div>
      </AdminPanel>
    </AdminPage>
  );
}
