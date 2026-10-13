"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, RefreshCw } from "lucide-react";

import {
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  adminButtonClass,
  adminQuietButtonStyle,
} from "@/components/admin/admin-page-ui";

type Check = {
  key: string;
  label: string;
  state: "confirmed" | "attention" | "unknown";
  detail: string;
  observedAt: string | null;
};

export default function SystemHealthPage() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/dev/health", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok)
      throw new Error("One or more health checks could not be completed.");
    setChecks(body.data.checks);
  }, []);
  useEffect(() => {
    void load().catch((caught) => setError(String(caught)));
  }, [load]);
  return (
    <AdminPage>
      <AdminPageHeader
        title="System health"
        description="What system problem needs technical action?"
        actions={
          <button
            className={adminButtonClass}
            style={adminQuietButtonStyle}
            onClick={() => void load()}
          >
            <RefreshCw size={15} /> Check now
          </button>
        }
      />
      {error ? (
        <AdminNotice tone="error" className="mt-6">
          {error}
        </AdminNotice>
      ) : null}
      {!checks && !error ? (
        <p className="mt-8 flex items-center gap-2">
          <Loader2 className="animate-spin" size={18} /> Checking current
          evidence
        </p>
      ) : null}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {(checks ?? []).map((check) => (
          <AdminPanel key={check.label}>
            <div className="flex items-start gap-3">
              {check.state === "confirmed" ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-800" />
              ) : (
                <CircleAlert className="h-6 w-6 shrink-0 text-amber-800" />
              )}
              <div>
                <h2 className="font-extrabold">{check.label}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#062F24]/65">
                  {check.detail}
                </p>
              </div>
            </div>
          </AdminPanel>
        ))}
      </div>
      {checks ? (
        <p className="mt-5 text-xs text-[#062F24]/50">
          Green appears only when a source returned affirmative evidence.
          Missing evidence remains unknown.
        </p>
      ) : null}
    </AdminPage>
  );
}
