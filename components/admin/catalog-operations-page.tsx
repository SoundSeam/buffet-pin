"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminSectionHeading,
  AdminStatusPill,
  adminButtonClass,
  adminFieldClass,
  adminLabelClass,
  adminPrimaryButtonStyle,
  adminQuietButtonStyle,
} from "@/components/admin/admin-page-ui";

const entityTypes = [
  "CATEGORY",
  "ITEM",
  "MODIFIER_GROUP",
  "MODIFIER_OPTION",
  "TAX_RATE",
  "ORDER_TYPE",
  "SERVICE_CHARGE",
] as const;

type EntityType = (typeof entityTypes)[number];
type Blocker = {
  entityType: EntityType;
  localKey: string;
  code: string;
  message: string;
};
type Report = {
  ready: boolean;
  requiredCount: number;
  verifiedCount: number;
  blockers: Blocker[];
  checkedAt: string;
};

function blockerExplanation(blocker: Blocker) {
  if (blocker.code.includes("STALE"))
    return "Clover changed since this item was last checked. Customers cannot buy it until the connection is confirmed.";
  if (blocker.code.includes("OWNERSHIP"))
    return "A modifier is connected to the wrong Clover item and must be corrected before customers can buy it.";
  if (blocker.code.includes("MISSING"))
    return "This menu item is not connected to Clover. Customers cannot buy it until the connection is added.";
  return "This Clover menu connection must be checked before customers can safely buy the item.";
}

export default function CatalogOperationsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [entityType, setEntityType] = useState<EntityType>("ITEM");
  const [localKey, setLocalKey] = useState("");
  const [providerId, setProviderId] = useState("");
  const [expectedProviderName, setExpectedProviderName] = useState("");
  const [expectedProviderRate, setExpectedProviderRate] = useState("");
  const [approvalReason, setApprovalReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/catalog/sync-report", {
      cache: "no-store",
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error?.message ?? "Unable to load catalog report.");
    }

    setReport(body.data);
  }, []);

  useEffect(() => {
    void load().catch((error) => setMessage(String(error)));
  }, [load]);

  const call = async (method: "POST" | "PUT", body?: object) => {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/catalog/sync-report", {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message ??
            result.error?.code ??
            "Catalog action failed.",
        );
      }

      await load();
      setMessage(
        method === "PUT"
          ? "All existing mappings reread from Clover."
          : `Mapping observed as ${result.data.mapping.status}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const logical = ["TAX_RATE", "ORDER_TYPE", "SERVICE_CHARGE"].includes(
    entityType,
  );
  const canObserve =
    localKey.trim() &&
    providerId.trim() &&
    (!logical ||
      (expectedProviderName.trim() &&
        approvalReason.trim() &&
        (entityType !== "TAX_RATE" || expectedProviderRate.trim())));

  return (
    <AdminPage>
      <AdminPageHeader
        title="Clover Menu Connection"
        description="Check that Buffet Pin’s delivery menu is correctly connected to Clover."
      />

      {message ? (
        <AdminNotice
          tone={report?.ready ? "success" : "warning"}
          className="mt-6"
        >
          {message}
        </AdminNotice>
      ) : null}

      <AdminPanel className="mt-8">
        <AdminSectionHeading
          title={
            report?.ready
              ? "The delivery menu is ready."
              : `${report?.blockers.length ?? 0} items must be fixed before customers can order.`
          }
          description="Every required delivery-menu connection must pass before checkout can open."
          aside={
            <button
              type="button"
              className={adminButtonClass}
              style={adminQuietButtonStyle}
              disabled={busy}
              onClick={() =>
                void call("PUT").catch((error) => setMessage(String(error)))
              }
            >
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
              Check menu now
            </button>
          }
        />

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] px-4 py-3">
          <AdminStatusPill>
            {report?.ready ? "Ready" : "Needs attention"}
          </AdminStatusPill>
          <p className="text-sm font-semibold text-[#062F24]">
            {report?.verifiedCount ?? 0} of {report?.requiredCount ?? 0}{" "}
            connected
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {report?.blockers.map((blocker) => (
            <article
              key={`${blocker.entityType}:${blocker.localKey}`}
              className="rounded-surface border border-[#062F24]/10 bg-white p-4 text-left"
            >
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-[#062F24]">
                  {blocker.localKey}
                </strong>
                <AdminStatusPill>{blocker.entityType}</AdminStatusPill>
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-[#062F24]/65">
                {blockerExplanation(blocker)}
              </span>
              <button
                type="button"
                className="mt-4 min-h-11 rounded-button border border-[#062F24]/15 px-4 text-sm font-semibold"
                onClick={() => {
                  setEntityType(blocker.entityType);
                  setLocalKey(blocker.localKey);
                }}
              >
                Check this connection
              </button>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-[#062F24]/60">
                  Technical details
                </summary>
                <span className="mt-2 block text-xs text-[#062F24]/55">
                  {blocker.code}: {blocker.message}
                </span>
              </details>
            </article>
          ))}
          {report?.blockers.length === 0 ? (
            <AdminEmptyState>The delivery menu is ready.</AdminEmptyState>
          ) : null}
        </div>
      </AdminPanel>

      <AdminPanel className="mt-6">
        <details>
          <summary className="cursor-pointer text-base font-extrabold text-[#062F24]">
            Technical details
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-[#062F24]/65">
            Check one menu connection against the current Clover record and
            preserve its verification evidence.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2">
              <span className={adminLabelClass}>Entity type</span>
              <select
                className={adminFieldClass}
                value={entityType}
                onChange={(event) =>
                  setEntityType(event.target.value as EntityType)
                }
              >
                {entityTypes.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className={adminLabelClass}>Local key</span>
              <input
                className={adminFieldClass}
                value={localKey}
                onChange={(event) => setLocalKey(event.target.value)}
                placeholder="Local key"
              />
            </label>
            <label className="grid gap-2">
              <span className={adminLabelClass}>Clover ID</span>
              <input
                className={adminFieldClass}
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
                placeholder="Provider record ID"
              />
            </label>
          </div>

          {logical ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2">
                <span className={adminLabelClass}>Exact Clover name</span>
                <input
                  className={adminFieldClass}
                  value={expectedProviderName}
                  onChange={(event) =>
                    setExpectedProviderName(event.target.value)
                  }
                  placeholder="Name or label"
                />
              </label>
              {entityType === "TAX_RATE" ? (
                <label className="grid gap-2">
                  <span className={adminLabelClass}>Exact raw rate</span>
                  <input
                    className={adminFieldClass}
                    value={expectedProviderRate}
                    onChange={(event) =>
                      setExpectedProviderRate(event.target.value)
                    }
                    placeholder="Clover rate"
                  />
                </label>
              ) : null}
              <label className="grid gap-2">
                <span className={adminLabelClass}>Approved purpose</span>
                <input
                  className={adminFieldClass}
                  value={approvalReason}
                  onChange={(event) => setApprovalReason(event.target.value)}
                  placeholder="Reason for this mapping"
                />
              </label>
            </div>
          ) : null}

          <button
            type="button"
            className={`${adminButtonClass} mt-5`}
            style={adminPrimaryButtonStyle}
            disabled={!canObserve || busy}
            onClick={() =>
              void call("POST", {
                entityType,
                localKey,
                providerId,
                ...(logical
                  ? {
                      expectedProviderName,
                      expectedProviderRate: expectedProviderRate || undefined,
                      approvalReason,
                    }
                  : {}),
              }).catch((error) => setMessage(String(error)))
            }
          >
            <ShieldCheck size={14} />
            {busy ? "Checking connection" : "Check again"}
          </button>
        </details>
      </AdminPanel>
    </AdminPage>
  );
}
