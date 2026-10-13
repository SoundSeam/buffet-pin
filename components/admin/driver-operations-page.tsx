"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

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
} from "@/components/admin/admin-page-ui";

type Zone = { id: string; name: string };
type DriverOperations = {
  id: string;
  name: string;
  zoneEligibilities: Array<{ deliveryZoneId: string; isActive: boolean }>;
  shifts: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
  }>;
};

const localInputValue = (date: Date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
};

export default function DriverOperationsPage({
  driverId,
}: {
  driverId: string;
}) {
  const [driver, setDriver] = useState<DriverOperations | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState(() => localInputValue(new Date()));
  const [endsAt, setEndsAt] = useState(() =>
    localInputValue(new Date(Date.now() + 8 * 60 * 60_000)),
  );
  const [reason, setReason] = useState("Scheduled dispatch coverage");
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [driverResponse, zonesResponse] = await Promise.all([
      fetch(`/api/admin/drivers/${driverId}/operations`, { cache: "no-store" }),
      fetch("/api/admin/delivery-zones", { cache: "no-store" }),
    ]);
    const driverBody = await driverResponse.json();
    const zonesBody = await zonesResponse.json();

    if (!driverResponse.ok || !zonesResponse.ok) {
      throw new Error("Unable to load driver operations.");
    }

    const next = driverBody.data.driver as DriverOperations;
    setDriver(next);
    setZones(zonesBody.data.zones);
    setZoneIds(
      next.zoneEligibilities
        .filter((entry) => entry.isActive)
        .map((entry) => entry.deliveryZoneId),
    );
  }, [driverId]);

  useEffect(() => {
    void load().catch((error) => {
      setHasError(true);
      setMessage(String(error));
    });
  }, [load]);

  const save = async () => {
    setBusy(true);
    setHasError(false);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/drivers/${driverId}/operations`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            zoneIds,
            shift: { startsAt, endsAt },
            reason,
          }),
        },
      );
      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error?.message ??
            body.error?.code ??
            "Unable to save driver operations.",
        );
      }

      setMessage("Eligibility and shift saved with an audit event.");
      await load();
    } catch (error) {
      setHasError(true);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title={`${driver?.name ?? "Driver"} operations`}
        description="Runs can only be approved and picked up while this driver is active, on shift, and eligible for every zone."
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
          title="Eligible delivery zones"
          description="Select every zone this driver is approved to serve during the scheduled shift."
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {zones.map((zone) => (
            <label
              key={zone.id}
              className="flex items-center justify-between gap-4 rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] px-4 py-3 text-sm font-semibold text-[#062F24]"
            >
              {zone.name}
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={zoneIds.includes(zone.id)}
                onChange={(event) =>
                  setZoneIds((current) =>
                    event.target.checked
                      ? [...current, zone.id]
                      : current.filter((id) => id !== zone.id),
                  )
                }
              />
            </label>
          ))}
        </div>
        {zones.length === 0 ? (
          <div className="mt-4">
            <AdminEmptyState>
              No active delivery zones are configured.
            </AdminEmptyState>
          </div>
        ) : null}
      </AdminPanel>

      <AdminPanel className="mt-6">
        <AdminSectionHeading
          title="Add shift"
          description="The reason is stored with the privileged change for later audit."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className={adminLabelClass}>Starts</span>
            <input
              type="datetime-local"
              className={adminFieldClass}
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </label>
          <label className="grid gap-2">
            <span className={adminLabelClass}>Ends</span>
            <input
              type="datetime-local"
              className={adminFieldClass}
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </label>
          <label className="grid gap-2 sm:col-span-2">
            <span className={adminLabelClass}>Audit reason</span>
            <input
              className={adminFieldClass}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className={`${adminButtonClass} mt-5`}
          style={adminPrimaryButtonStyle}
          disabled={busy || zoneIds.length === 0 || !reason.trim()}
          onClick={() => void save()}
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {busy ? "Saving" : "Save operations"}
        </button>
      </AdminPanel>

      <AdminPanel className="mt-6">
        <AdminSectionHeading title="Recent shifts" />
        <div className="mt-4 divide-y divide-[#062F24]/10 overflow-hidden rounded-surface border border-[#062F24]/10">
          {driver?.shifts.map((shift) => (
            <div
              key={shift.id}
              className="flex flex-col justify-between gap-2 px-4 py-4 text-sm text-[#062F24] sm:flex-row sm:items-center"
            >
              <span className="font-semibold">
                {new Date(shift.startsAt).toLocaleString()} –{" "}
                {new Date(shift.endsAt).toLocaleString()}
              </span>
              <AdminStatusPill>
                {shift.isActive ? "Active" : "Disabled"}
              </AdminStatusPill>
            </div>
          ))}
          {driver?.shifts.length === 0 ? (
            <div className="p-4">
              <AdminEmptyState>No shifts have been recorded.</AdminEmptyState>
            </div>
          ) : null}
        </div>
      </AdminPanel>
    </AdminPage>
  );
}
