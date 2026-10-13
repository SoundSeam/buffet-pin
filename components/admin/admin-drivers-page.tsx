"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Plus, RefreshCw, RotateCw, Save } from "lucide-react";

import {
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/admin-page-ui";

type DriverAccessToken = {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

type AdminDriver = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accessTokens: DriverAccessToken[];
};

type DriverForm = {
  name: string;
  phone: string;
  email: string;
};

type ApiResult =
  | {
      ok: true;
      data: {
        drivers?: AdminDriver[];
        driver?: AdminDriver;
        accessUrl?: string;
        accessToken?: DriverAccessToken;
      };
    }
  | { ok: false; error?: { code?: string; message?: string } };

const emptyForm: DriverForm = {
  name: "",
  phone: "",
  email: "",
};

const fieldClass =
  "w-full rounded-button border border-[rgba(6,47,36,0.12)] bg-[rgba(6,47,36,0.05)] px-3 py-2.5 text-sm text-[#062F24] focus:outline-none focus-visible:outline-none focus-visible:outline-0";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50";
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

function formatApiError(result: ApiResult, fallback: string) {
  const message = "error" in result ? result.error?.message : null;
  const code = "error" in result ? result.error?.code : null;
  return code ? `${message ?? fallback} (${code})` : message ?? fallback;
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function driverPayload(form: DriverForm, isActive?: boolean) {
  return {
    name: form.name.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    ...(isActive === undefined ? {} : { isActive }),
  };
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [edits, setEdits] = useState<Record<string, DriverForm>>({});
  const [accessUrls, setAccessUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyDriverId, setBusyDriverId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeCount = useMemo(
    () => drivers.filter((driver) => driver.isActive).length,
    [drivers],
  );

  const loadDrivers = async () => {
    setError("");

    try {
      const response = await fetch("/api/admin/drivers", { cache: "no-store" });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.ok) {
        throw new Error(formatApiError(result, "Unable to load drivers."));
      }

      const nextDrivers = result.data.drivers ?? [];
      setDrivers(nextDrivers);
      setEdits(
        Object.fromEntries(
          nextDrivers.map((driver) => [
            driver.id,
            {
              name: driver.name,
              phone: driver.phone ?? "",
              email: driver.email ?? "",
            },
          ]),
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load drivers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDrivers();
  }, []);

  const copyAccessUrl = async (driverId: string) => {
    const accessUrl = accessUrls[driverId];
    if (!accessUrl) return;

    await navigator.clipboard.writeText(accessUrl);
    setSuccess("Driver link copied.");
  };

  const createDriver = async () => {
    if (!form.name.trim() || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(driverPayload(form, true)),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.ok || !result.data.driver) {
        throw new Error(formatApiError(result, "Unable to create driver."));
      }

      setForm(emptyForm);
      setDrivers((current) => [result.data.driver!, ...current]);
      setEdits((current) => ({
        ...current,
        [result.data.driver!.id]: {
          name: result.data.driver!.name,
          phone: result.data.driver!.phone ?? "",
          email: result.data.driver!.email ?? "",
        },
      }));
      if (result.data.accessUrl) {
        setAccessUrls((current) => ({
          ...current,
          [result.data.driver!.id]: result.data.accessUrl!,
        }));
      }
      setSuccess("Driver created. Copy the private link now.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create driver.");
    } finally {
      setSaving(false);
    }
  };

  const updateDriver = async (driver: AdminDriver, isActive = driver.isActive) => {
    const edit = edits[driver.id];
    if (!edit || busyDriverId) return;

    setBusyDriverId(driver.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(driverPayload(edit, isActive)),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.ok || !result.data.driver) {
        throw new Error(formatApiError(result, "Unable to update driver."));
      }

      setDrivers((current) =>
        current.map((item) => (item.id === driver.id ? result.data.driver! : item)),
      );
      setEdits((current) => ({
        ...current,
        [driver.id]: {
          name: result.data.driver!.name,
          phone: result.data.driver!.phone ?? "",
          email: result.data.driver!.email ?? "",
        },
      }));
      setSuccess(isActive ? "Driver updated." : "Driver deactivated.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update driver.");
    } finally {
      setBusyDriverId(null);
    }
  };

  const regenerateLink = async (driver: AdminDriver) => {
    if (busyDriverId) return;

    setBusyDriverId(driver.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/drivers/${driver.id}/access-link`, {
        method: "POST",
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.ok || !result.data.accessUrl) {
        throw new Error(formatApiError(result, "Unable to regenerate link."));
      }

      setAccessUrls((current) => ({
        ...current,
        [driver.id]: result.data.accessUrl!,
      }));
      await loadDrivers();
      setSuccess("New driver link created. Copy it now.");
    } catch (regenerateError) {
      setError(
        regenerateError instanceof Error ? regenerateError.message : "Unable to regenerate link.",
      );
    } finally {
      setBusyDriverId(null);
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Drivers"
        description={`${activeCount} active driver${activeCount === 1 ? "" : "s"}`}
        actions={
          <button
            type="button"
            className={buttonClass}
            onClick={() => void loadDrivers()}
            style={quietButtonStyle}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        }
      />

        {(error || success) && (
          <div
            className={
              error
                ? "mt-6 rounded-surface border border-red-900/20 bg-red-900/10 p-4 text-sm text-red-800"
                : "mt-6 rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] p-4 text-sm font-semibold"
            }
            role="status"
            aria-live="polite"
            style={
              error
                ? undefined
                : {
                    borderColor: "rgba(6,95,70,0.18)",
                    color: "#065F46",
                    background: "#F0FDF4",
                  }
            }
          >
            {error || success}
          </div>
        )}

        <form
          className="mt-8 grid gap-3 rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] p-4 shadow-sm lg:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void createDriver();
          }}
        >
          <input
            className={fieldClass}
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Driver name"
            aria-label="Driver name"
          />
          <input
            className={fieldClass}
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="Phone"
            aria-label="Phone"
          />
          <input
            className={fieldClass}
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="Email optional"
            aria-label="Email optional"
            type="email"
          />
          <button
            type="submit"
            className={buttonClass}
            disabled={saving || !form.name.trim()}
            style={primaryButtonStyle}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add driver
          </button>
        </form>

        {loading ? (
          <div className="mt-8 flex items-center gap-3 rounded-surface border border-[#062F24]/10 bg-white p-6 text-[#062F24] shadow-sm">
            <Loader2 size={16} className="animate-spin" />
            Loading drivers
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-surface-lg border border-[#062F24]/10 bg-white shadow-sm">
            <div className="hidden grid-cols-[1.1fr_1fr_1fr_0.8fr_1.2fr] gap-3 bg-[rgba(6,47,36,0.05)] px-4 py-3 text-xs font-extrabold uppercase text-[#062F24]/70 lg:grid">
              <span>Name</span>
              <span>Phone</span>
              <span>Email</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-[rgba(6,47,36,0.1)] bg-white">
              {drivers.length === 0 ? (
                <div className="m-4 rounded-surface border border-dashed border-[#062F24]/15 px-4 py-10 text-center text-sm font-semibold text-[#062F24]/45">
                  No drivers yet.
                </div>
              ) : (
                drivers.map((driver) => {
                  const edit = edits[driver.id] ?? {
                    name: driver.name,
                    phone: driver.phone ?? "",
                    email: driver.email ?? "",
                  };
                  const accessUrl = accessUrls[driver.id];
                  const latestToken = driver.accessTokens[0];
                  const busy = busyDriverId === driver.id;

                  return (
                    <div
                      key={driver.id}
                      className="grid gap-4 px-4 py-4 lg:grid-cols-[1.1fr_1fr_1fr_0.8fr_1.2fr] lg:items-center"
                    >
                      <label className="grid gap-1">
                        <span className="text-xs font-bold uppercase text-[#062F24]/50 lg:hidden">
                          Name
                        </span>
                        <input
                          className={fieldClass}
                          value={edit.name}
                          onChange={(event) =>
                            setEdits((current) => ({
                              ...current,
                              [driver.id]: { ...edit, name: event.target.value },
                            }))
                          }
                          aria-label={`${driver.name} name`}
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs font-bold uppercase text-[#062F24]/50 lg:hidden">
                          Phone
                        </span>
                        <input
                          className={fieldClass}
                          value={edit.phone}
                          onChange={(event) =>
                            setEdits((current) => ({
                              ...current,
                              [driver.id]: { ...edit, phone: event.target.value },
                            }))
                          }
                          placeholder="Phone"
                          aria-label={`${driver.name} phone`}
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs font-bold uppercase text-[#062F24]/50 lg:hidden">
                          Email
                        </span>
                        <input
                          className={fieldClass}
                          type="email"
                          value={edit.email}
                          onChange={(event) =>
                            setEdits((current) => ({
                              ...current,
                              [driver.id]: { ...edit, email: event.target.value },
                            }))
                          }
                          placeholder="Email optional"
                          aria-label={`${driver.name} email`}
                        />
                      </label>
                      <div>
                        <span
                          className="inline-flex rounded-button px-3 py-1 text-xs font-bold"
                          style={
                            driver.isActive
                              ? { background: "#DDF7E8", color: "#065F46" }
                              : { background: "rgba(6,47,36,0.05)", color: "#062F24" }
                          }
                        >
                          {driver.isActive ? "Active" : "Inactive"}
                        </span>
                        <p className="mt-2 text-xs font-semibold text-[#062F24]/55">
                          Link used {formatDateTime(latestToken?.lastUsedAt ?? null)}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => void updateDriver(driver)}
                          disabled={busy || !edit.name.trim()}
                          style={quietButtonStyle}
                        >
                          {busy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Save size={14} />
                          )}
                          Save
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => void regenerateLink(driver)}
                          disabled={busy}
                          style={quietButtonStyle}
                        >
                          <RotateCw size={14} />
                          Regenerate
                        </button>
                        {accessUrl ? (
                          <button
                            type="button"
                            className={buttonClass}
                            onClick={() => void copyAccessUrl(driver.id)}
                            style={primaryButtonStyle}
                          >
                            <Copy size={14} />
                            Copy link
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => void updateDriver(driver, !driver.isActive)}
                          disabled={busy}
                          style={driver.isActive ? dangerButtonStyle : quietButtonStyle}
                        >
                          {driver.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                        <Link
                          className={buttonClass}
                          href={`/admin/drivers/${driver.id}/operations`}
                          style={quietButtonStyle}
                        >
                          Zones & shifts
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
    </AdminPage>
  );
}
