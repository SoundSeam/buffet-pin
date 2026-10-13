"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Save, ShieldAlert } from "lucide-react";

import DeliveryZoneMap, {
  type DeliveryZoneMapItem,
} from "@/components/admin/delivery-zone-map";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page-ui";

type Zone = DeliveryZoneMapItem & {
  id?: string;
  isActive?: boolean;
  description: string | null;
  targetDriveMinutes: number | null;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  freeDeliveryThresholdCents: number | null;
  sortOrder: number;
};

type ZoneResponse = {
  zones: Zone[];
  recommendedZones: Zone[];
  restaurant: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  onlineOrderingEnabled: boolean;
};

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function ZoneEconomicsEditor({
  zone,
  orderingEnabled,
  onSaved,
}: {
  zone: Zone;
  orderingEnabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fee, setFee] = useState((zone.deliveryFeeCents / 100).toFixed(2));
  const [minimum, setMinimum] = useState(
    (zone.minimumOrderCents / 100).toFixed(2),
  );
  const [freeAt, setFreeAt] = useState(
    zone.freeDeliveryThresholdCents === null
      ? ""
      : (zone.freeDeliveryThresholdCents / 100).toFixed(2),
  );
  const [targetMinutes, setTargetMinutes] = useState(
    String(zone.targetDriveMinutes ?? 15),
  );

  const save = async () => {
    if (!zone.id || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/delivery-zones/${zone.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deliveryFeeCents: Math.round(Number(fee) * 100),
          minimumOrderCents: Math.round(Number(minimum) * 100),
          freeDeliveryThresholdCents: freeAt.trim()
            ? Math.round(Number(freeAt) * 100)
            : null,
          targetDriveMinutes: Number(targetMinutes),
          reason: `Manager updated launch economics for ${zone.name}.`,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error?.message ?? "Unable to save this zone.");
        return;
      }
      setEditing(false);
      await onSaved();
    } catch {
      setError("Unable to save this zone.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        className={`${buttonClass} mt-4 w-full`}
        style={{ background: "rgba(6,47,36,0.05)", color: "#062F24" }}
        onClick={() => setEditing(true)}
        disabled={orderingEnabled}
      >
        <Pencil size={14} /> Change fee or minimum
      </button>
    );
  }

  const fieldClass =
    "mt-1 w-full rounded-button border border-[#062F24]/15 bg-white px-3 py-2 text-sm text-[#062F24]";

  return (
    <div className="mt-4 border-t border-[#062F24]/10 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold text-[#062F24]/65">
          Fee (CAD)
          <input
            aria-label={`${zone.name} fee`}
            className={fieldClass}
            type="number"
            min="0"
            step="0.01"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
          />
        </label>
        <label className="text-xs font-bold text-[#062F24]/65">
          Minimum (CAD)
          <input
            aria-label={`${zone.name} minimum`}
            className={fieldClass}
            type="number"
            min="0"
            step="0.01"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
          />
        </label>
        <label className="text-xs font-bold text-[#062F24]/65">
          Free at (blank = off)
          <input
            aria-label={`${zone.name} free delivery threshold`}
            className={fieldClass}
            type="number"
            min="0"
            step="0.01"
            value={freeAt}
            onChange={(event) => setFreeAt(event.target.value)}
          />
        </label>
        <label className="text-xs font-bold text-[#062F24]/65">
          Target minutes
          <input
            aria-label={`${zone.name} target minutes`}
            className={fieldClass}
            type="number"
            min="1"
            max="120"
            step="1"
            value={targetMinutes}
            onChange={(event) => setTargetMinutes(event.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p className="mt-3 text-xs font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={buttonClass}
          style={{ background: "#062F24", color: "#FFFFFF" }}
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}{" "}
          Save
        </button>
        <button
          type="button"
          className={buttonClass}
          style={{ background: "rgba(6,47,36,0.05)", color: "#062F24" }}
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminDeliveryZonesPage() {
  const [data, setData] = useState<ZoneResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/admin/delivery-zones?includeInactive=true",
        {
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error?.message ?? "Unable to load delivery zones.");
        return;
      }
      setData(result.data as ZoneResponse);
    } catch {
      setError("Unable to load delivery zones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recommendedKeys = useMemo(
    () =>
      new Set(
        data?.recommendedZones.map((zone) => zone.configurationKey) ?? [],
      ),
    [data?.recommendedZones],
  );
  const installed = Boolean(
    data &&
    recommendedKeys.size === 4 &&
    data.zones.filter(
      (zone) =>
        zone.isActive &&
        zone.configurationKey &&
        recommendedKeys.has(zone.configurationKey),
    ).length === 4,
  );
  const displayedZones = installed
    ? (data?.zones.filter(
        (zone) =>
          zone.isActive &&
          zone.configurationKey &&
          recommendedKeys.has(zone.configurationKey),
      ) ?? [])
    : (data?.recommendedZones ?? []);

  const install = async () => {
    if (!data || data.onlineOrderingEnabled || installing) return;
    if (
      !window.confirm(
        "Install these four zones and disable the old active delivery area? Existing orders and history stay unchanged.",
      )
    ) {
      return;
    }

    setInstalling(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "INSTALL_RECOMMENDED_CHATEAUGUAY_ZONES",
          reason:
            "Manager installed the reviewed Châteauguay road-corridor launch zones.",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error?.message ?? "Unable to install delivery zones.");
        return;
      }
      setSuccess("Four delivery zones installed. Public ordering remains off.");
      await load();
    } catch {
      setError("Unable to install delivery zones.");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Delivery zones"
        description="Four driver-friendly corridors from 90 Boulevard Saint Jean Baptiste. Montréal and the Mercier Bridge are outside the launch area."
        actions={
          <button
            type="button"
            className={buttonClass}
            style={{ background: "#062F24", color: "#FFFFFF" }}
            onClick={() => void install()}
            disabled={
              loading ||
              installing ||
              installed ||
              Boolean(data?.onlineOrderingEnabled)
            }
          >
            {installing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CheckCircle2 size={15} />
            )}
            {installed
              ? "Four zones installed"
              : installing
                ? "Installing"
                : "Install these four zones"}
          </button>
        }
      />

      {data?.onlineOrderingEnabled ? (
        <div className="mt-6 flex gap-3 rounded-surface border border-amber-700/25 bg-amber-50 p-4 text-sm text-amber-950">
          <ShieldAlert
            size={18}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <p>
            <strong>Online ordering is on.</strong> Turn it off in Settings →
            Ordering before changing delivery coverage. This prevents a customer
            checking out while the map changes.
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          className="mt-6 rounded-surface border border-red-900/20 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="mt-6 rounded-surface border border-emerald-900/20 bg-emerald-50 p-4 text-sm text-emerald-800"
          role="status"
        >
          {success}
        </p>
      ) : null}

      {loading || !data ? (
        <div className="mt-8 flex items-center gap-3 rounded-surface border border-[#062F24]/10 p-6 text-sm font-semibold text-[#062F24]">
          <Loader2 size={16} className="animate-spin" /> Loading zones
        </div>
      ) : (
        <>
          {!installed ? (
            <p className="mt-6 rounded-surface border border-blue-900/15 bg-blue-50 p-4 text-sm text-blue-950">
              This is the proposed map. Installing it disables old active zones,
              preserves their history, and keeps public ordering off.
            </p>
          ) : null}

          <div className="mt-6">
            <DeliveryZoneMap
              key={installed ? "installed" : "recommended"}
              zones={displayedZones}
              restaurant={data.restaurant}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {displayedZones.map((zone) => (
              <article
                key={zone.configurationKey ?? zone.name}
                className="rounded-surface border border-[#062F24]/10 bg-white p-5 shadow-sm"
                style={{
                  borderTop: `5px solid ${zone.displayColor ?? "#0F766E"}`,
                }}
              >
                <h2 className="text-base font-extrabold text-[#062F24]">
                  {zone.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#062F24]/65">
                  {zone.description}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-[#062F24]/45">
                      Target
                    </dt>
                    <dd className="mt-1 font-bold text-[#062F24]">
                      ≤ {zone.targetDriveMinutes} min
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-[#062F24]/45">
                      Fee
                    </dt>
                    <dd className="mt-1 font-bold text-[#062F24]">
                      {formatMoney(zone.deliveryFeeCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-[#062F24]/45">
                      Minimum
                    </dt>
                    <dd className="mt-1 font-bold text-[#062F24]">
                      {formatMoney(zone.minimumOrderCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-[#062F24]/45">
                      Free delivery
                    </dt>
                    <dd className="mt-1 font-bold text-[#062F24]">
                      {zone.freeDeliveryThresholdCents === null
                        ? "Off"
                        : formatMoney(zone.freeDeliveryThresholdCents)}
                    </dd>
                  </div>
                </dl>
                {installed && zone.id ? (
                  <ZoneEconomicsEditor
                    zone={zone}
                    orderingEnabled={data.onlineOrderingEnabled}
                    onSaved={load}
                  />
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] p-5 text-sm leading-relaxed text-[#062F24]/75">
            <strong className="text-[#062F24]">Before go-live:</strong> drive
            one outer address in each zone during the actual dinner period.
            Confirm the kitchen-to-door time, parking, and whether the target
            minutes still hold in traffic. Fees and minimums are conservative
            launch defaults and need owner approval.
          </div>
        </>
      )}
    </AdminPage>
  );
}
