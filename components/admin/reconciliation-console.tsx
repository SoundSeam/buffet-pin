"use client";

import { useState } from "react";
import { CheckCircle2, Download, Upload } from "lucide-react";

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
  adminLabelClass,
  adminPrimaryButtonStyle,
  adminQuietButtonStyle,
} from "@/components/admin/admin-page-ui";

type Variance = {
  id: string;
  varianceKey: string;
  status: string;
  reasons: string[];
  orderNumber: string | null;
};
type Result = {
  providerDataStatus: string;
  report: { summary: Record<string, number> };
  latestImport?: { variances: Variance[] } | null;
  import?: { variances: Variance[] };
};

export default function ReconciliationConsole({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [date, setDate] = useState(yesterday);
  const [rows, setRows] = useState("[]");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = async (method: "GET" | "POST") => {
    setBusy(true);
    setHasError(false);
    setMessage("");

    try {
      const response = await fetch(
        method === "GET"
          ? `/api/admin/reconciliation?date=${date}`
          : "/api/admin/reconciliation",
        method === "GET"
          ? { cache: "no-store" }
          : {
              method,
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ date, providerRows: JSON.parse(rows) }),
            },
      );
      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error?.message ??
            body.error?.code ??
            "Reconciliation request failed.",
        );
      }

      setResult(body.data);
      setMessage(
        method === "POST"
          ? "Sanitized Clover report imported and compared."
          : "Daily close loaded.",
      );
    } catch (error) {
      setHasError(true);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const updateVariance = async (
    variance: Variance,
    action: "ACKNOWLEDGE" | "RESOLVE",
  ) => {
    const reason = window.prompt(
      action === "RESOLVE"
        ? "Provider evidence and resolution note"
        : "Owner and next action",
    );
    if (!reason?.trim()) return;
    const response = await fetch(
      `/api/admin/reconciliation/variances/${variance.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason }),
      },
    );
    if (!response.ok) throw new Error("Variance update failed.");
    await request("GET");
  };
  const variances =
    result?.latestImport?.variances ?? result?.import?.variances ?? [];
  return (
    <AdminPage>
      <AdminPageHeader
        title="Money comparison"
        description={
          readOnly
            ? "Review the local daily close and the latest imported Clover comparison."
            : "Investigate detailed Buffet Pin and Clover differences. Import only sanitized IDs and cent amounts—never card data."
        }
      />
      {message ? (
        <AdminNotice
          tone={hasError ? "error" : "success"}
          role={hasError ? "alert" : "status"}
          className="mt-6"
        >
          {message}
        </AdminNotice>
      ) : null}
      <AdminPanel className="mt-8">
        <AdminSectionHeading
          title="Comparison evidence"
          description="Choose a service date and load current evidence. Can’t connect to Clover? Upload the sanitized Clover closing report instead."
        />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid w-full gap-2 sm:max-w-56">
            <span className={adminLabelClass}>Service date</span>
            <input
              type="date"
              className={adminFieldClass}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={adminButtonClass}
            style={adminQuietButtonStyle}
            disabled={busy}
            onClick={() => void request("GET")}
          >
            <Download size={14} />
            {busy ? "Loading" : "Load daily close"}
          </button>
        </div>
        {!readOnly ? (
          <>
            <label className="mt-5 grid gap-2" htmlFor="provider-rows">
              <span className={adminLabelClass}>
                Sanitized provider rows (JSON)
              </span>
              <textarea
                id="provider-rows"
                className={`${adminFieldClass} min-h-64 resize-y font-mono text-xs leading-relaxed`}
                value={rows}
                onChange={(event) => setRows(event.target.value)}
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className={`${adminButtonClass} mt-4`}
              style={adminPrimaryButtonStyle}
              disabled={busy}
              onClick={() => void request("POST")}
            >
              <Upload size={14} />
              {busy ? "Comparing" : "Import and compare"}
            </button>
          </>
        ) : null}
      </AdminPanel>
      {result && (
        <AdminPanel className="mt-6">
          <AdminSectionHeading
            title="Comparison result"
            aside={
              <AdminStatusPill>{result.providerDataStatus}</AdminStatusPill>
            }
          />
          <pre className="mt-4 overflow-auto rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] p-4 text-xs leading-relaxed text-[#062F24]">
            {JSON.stringify(result.report.summary, null, 2)}
          </pre>
          <div className="mt-5 grid gap-3">
            {variances.map((variance) => (
              <article
                key={variance.id}
                className="flex flex-col justify-between gap-4 rounded-surface border border-[#062F24]/10 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-[#062F24]">
                      {variance.orderNumber ?? variance.varianceKey}
                    </strong>
                    <AdminStatusPill>{variance.status}</AdminStatusPill>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#062F24]/65">
                    {variance.reasons.join(", ")}
                  </p>
                </div>
                {!readOnly ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={adminCompactButtonClass}
                      style={adminQuietButtonStyle}
                      onClick={() =>
                        void updateVariance(variance, "ACKNOWLEDGE").catch(
                          (error) => setMessage(String(error)),
                        )
                      }
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      className={adminCompactButtonClass}
                      style={adminPrimaryButtonStyle}
                      onClick={() =>
                        void updateVariance(variance, "RESOLVE").catch(
                          (error) => setMessage(String(error)),
                        )
                      }
                    >
                      <CheckCircle2 size={14} />
                      Resolve with evidence
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
            {variances.length === 0 ? (
              <AdminEmptyState>
                No variances are open for this report.
              </AdminEmptyState>
            ) : null}
          </div>
        </AdminPanel>
      )}
    </AdminPage>
  );
}
