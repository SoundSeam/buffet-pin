"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Save } from "lucide-react";

import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page-ui";

type OrderSettings = {
  onlineOrderingEnabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  busyModeEnabled: boolean;
  busyModeExtraMinutes: number;
  maxActiveOrders: number | null;
  acceptanceWindowMinutes: number;
  missedAcceptancePauseThreshold: number;
  proofRetentionDays: number;
  partialRefundsEnabled: boolean;
  receiptLegalName: string | null;
  receiptAddress: string | null;
  receiptPhone: string | null;
  receiptTaxRegistration: string | null;
  restaurantLatitude: number | null;
  restaurantLongitude: number | null;
  deliveryRadiusKm: number;
  deliveryFeeCents: number;
  minimumDeliveryOrderCents: number;
  freeDeliveryThresholdCents: number | null;
  orderAdminSmsRecipient: string | null;
};

type DeliveryAddressForm = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

const emptySettings: OrderSettings = {
  onlineOrderingEnabled: false,
  pickupEnabled: false,
  deliveryEnabled: false,
  busyModeEnabled: false,
  busyModeExtraMinutes: 0,
  maxActiveOrders: null,
  acceptanceWindowMinutes: 12,
  missedAcceptancePauseThreshold: 2,
  proofRetentionDays: 30,
  partialRefundsEnabled: false,
  receiptLegalName: null,
  receiptAddress: null,
  receiptPhone: null,
  receiptTaxRegistration: null,
  restaurantLatitude: null,
  restaurantLongitude: null,
  deliveryRadiusKm: 8,
  deliveryFeeCents: 0,
  minimumDeliveryOrderCents: 0,
  freeDeliveryThresholdCents: null,
  orderAdminSmsRecipient: null,
};

const emptyAddress: DeliveryAddressForm = {
  addressLine1: "",
  addressLine2: "",
  city: "Montreal",
  province: "QC",
  postalCode: "",
  country: "CA",
};

const fieldClass =
  "w-full rounded-button border border-[rgba(6,47,36,0.14)] bg-white px-3 py-2.5 text-sm text-[#062F24] focus:outline-none focus-visible:outline-none focus-visible:outline-0";
const labelClass =
  "text-xs font-bold uppercase tracking-[0.12em] text-[#062F24]/55";
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

function settingsSignature(settings: OrderSettings) {
  return JSON.stringify(settings);
}

function centsToDollars(value: number | null) {
  if (value === null) {
    return "";
  }

  return (value / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  const trimmed = value.trim();
  return Math.round(Number(trimmed || "0") * 100);
}

function nullableDollarsToCents(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return Math.round(Number(trimmed) * 100);
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

export default function AdminOrderSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState("");
  const [initialSettings, setInitialSettings] =
    useState<OrderSettings>(emptySettings);
  const [settings, setSettings] = useState<OrderSettings>(emptySettings);
  const [address, setAddress] = useState<DeliveryAddressForm>(emptyAddress);

  const hasUnsavedChanges = useMemo(
    () => settingsSignature(settings) !== settingsSignature(initialSettings),
    [initialSettings, settings],
  );

  const formValid =
    settings.deliveryRadiusKm > 0 &&
    settings.deliveryFeeCents >= 0 &&
    settings.minimumDeliveryOrderCents >= 0 &&
    settings.busyModeExtraMinutes >= 0 &&
    settings.busyModeExtraMinutes <= 180 &&
    settings.acceptanceWindowMinutes >= 1 &&
    settings.acceptanceWindowMinutes <= 30 &&
    settings.missedAcceptancePauseThreshold >= 1 &&
    settings.missedAcceptancePauseThreshold <= 10 &&
    settings.proofRetentionDays >= 1 &&
    settings.proofRetentionDays <= 365 &&
    (settings.maxActiveOrders === null ||
      (settings.maxActiveOrders >= 1 && settings.maxActiveOrders <= 200)) &&
    (settings.freeDeliveryThresholdCents === null ||
      settings.freeDeliveryThresholdCents >=
        settings.minimumDeliveryOrderCents);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/order-settings", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!result.ok) {
          setError(result.error?.message ?? "Unable to load order settings.");
          return;
        }

        const nextSettings = {
          ...(result.data.settings as OrderSettings),
          pickupEnabled: false,
        };
        setInitialSettings(nextSettings);
        setSettings(nextSettings);
      } catch {
        setError("Unable to load order settings.");
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const updateSettings = <Key extends keyof OrderSettings>(
    key: Key,
    value: OrderSettings[Key],
  ) => {
    setSuccess("");
    setError("");
    setTestResult("");
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveChanges = async () => {
    if (!hasUnsavedChanges || !formValid) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/order-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, pickupEnabled: false }),
      });
      const result = await response.json();

      if (!result.ok) {
        setError(result.error?.message ?? "Unable to save order settings.");
        return;
      }

      const nextSettings = {
        ...(result.data.settings as OrderSettings),
        pickupEnabled: false,
      };
      setInitialSettings(nextSettings);
      setSettings(nextSettings);
      setSuccess("Order settings saved.");
    } catch {
      setError("Unable to save order settings.");
    } finally {
      setSaving(false);
    }
  };

  const validateAddress = async () => {
    setTesting(true);
    setError("");
    setTestResult("");

    try {
      const response = await fetch("/api/admin/delivery/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          itemsSubtotalCents: settings.minimumDeliveryOrderCents,
        }),
      });
      const result = await response.json();

      if (!result.ok) {
        setTestResult(
          result.error?.message ?? "Address is not eligible for delivery.",
        );
        return;
      }

      const delivery = result.data.delivery as {
        distanceKm: number;
        deliveryFeeCents: number;
        address: { formattedAddress: string };
      };

      setTestResult(
        `${delivery.address.formattedAddress} · ${delivery.distanceKm.toFixed(
          2,
        )} km · $${centsToDollars(delivery.deliveryFeeCents)}`,
      );
    } catch {
      setTestResult("Unable to validate this address.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Order settings"
        actions={
          <>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setSettings(initialSettings);
                setError("");
                setSuccess("");
                setTestResult("");
              }}
              disabled={!hasUnsavedChanges || saving}
              style={quietButtonStyle}
            >
              Discard
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={saveChanges}
              disabled={!hasUnsavedChanges || !formValid || saving}
              style={primaryButtonStyle}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saving ? "Saving" : "Save changes"}
            </button>
          </>
        }
      />

      {error ? (
        <p
          className="mt-6 rounded-surface border border-red-900/20 bg-red-900/10 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          className="mt-6 flex items-center gap-2 rounded-surface border border-emerald-900/20 bg-emerald-900/10 p-4 text-sm text-emerald-800"
          role="status"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {success}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-8 flex items-center gap-3 rounded-surface border border-[#062F24]/10 bg-white p-6 text-[#062F24] shadow-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading order settings
        </div>
      ) : (
        <div className="mt-8 grid gap-8">
          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["onlineOrderingEnabled", "Online ordering"],
                ["deliveryEnabled", "Delivery"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] px-4 py-3 text-sm font-semibold text-[#062F24]"
                >
                  {label}
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={Boolean(settings[key as keyof OrderSettings])}
                    onChange={(event) =>
                      updateSettings(
                        key as keyof OrderSettings,
                        event.target.checked as never,
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#062F24]">
              Launch safety
            </h2>
            <p className="mt-1 text-sm text-[#062F24]/65">
              Keep online ordering off while testing. Set a small order cap
              before the pilot.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between gap-4 rounded-surface border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] px-4 py-3 text-sm font-semibold text-[#062F24]">
                Busy mode
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={settings.busyModeEnabled}
                  onChange={(event) =>
                    updateSettings("busyModeEnabled", event.target.checked)
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Extra minutes in busy mode</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  max={180}
                  value={settings.busyModeExtraMinutes}
                  onChange={(event) =>
                    updateSettings(
                      "busyModeExtraMinutes",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Maximum active orders</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={1}
                  max={200}
                  value={settings.maxActiveOrders ?? ""}
                  placeholder="Required before pilot"
                  onChange={(event) =>
                    updateSettings(
                      "maxActiveOrders",
                      toNullableNumber(event.target.value),
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Order response minutes</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={1}
                  max={30}
                  value={settings.acceptanceWindowMinutes}
                  onChange={(event) =>
                    updateSettings(
                      "acceptanceWindowMinutes",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Misses before intake pauses</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={1}
                  max={10}
                  value={settings.missedAcceptancePauseThreshold}
                  onChange={(event) =>
                    updateSettings(
                      "missedAcceptancePauseThreshold",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Delivery proof retention days</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={1}
                  max={365}
                  value={settings.proofRetentionDays}
                  onChange={(event) =>
                    updateSettings(
                      "proofRetentionDays",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>
          </section>

          <details className="rounded-surface border border-[#062F24]/10 bg-white p-5">
            <summary className="cursor-pointer text-base font-extrabold text-[#062F24]">
              Advanced ordering policy
            </summary>
            <p className="mt-2 text-sm text-[#062F24]/65">
              Keep partial refunds off unless the restaurant has approved who
              may use them.
            </p>
            <label className="mt-4 flex items-center justify-between gap-4 rounded-surface border border-amber-900/20 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
              Allow partial refunds
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={settings.partialRefundsEnabled}
                onChange={(event) =>
                  updateSettings("partialRefundsEnabled", event.target.checked)
                }
              />
            </label>
          </details>

          <details className="rounded-surface border border-[#062F24]/10 bg-white p-5">
            <summary className="cursor-pointer text-base font-extrabold text-[#062F24]">
              Legacy delivery fallback
            </summary>
            <p className="mt-2 text-sm text-[#062F24]/65">
              Active polygon zones own customer fees and minimums. These values
              are retained only for safe fallback and routing origin
              configuration.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className={labelClass}>Restaurant latitude</span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.000001"
                  value={settings.restaurantLatitude ?? ""}
                  onChange={(event) =>
                    updateSettings(
                      "restaurantLatitude",
                      toNullableNumber(event.target.value),
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Restaurant longitude</span>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.000001"
                  value={settings.restaurantLongitude ?? ""}
                  onChange={(event) =>
                    updateSettings(
                      "restaurantLongitude",
                      toNullableNumber(event.target.value),
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Radius km</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  step="0.1"
                  value={settings.deliveryRadiusKm}
                  onChange={(event) =>
                    updateSettings(
                      "deliveryRadiusKm",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Delivery fee</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={centsToDollars(settings.deliveryFeeCents)}
                  onChange={(event) =>
                    updateSettings(
                      "deliveryFeeCents",
                      dollarsToCents(event.target.value),
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Minimum delivery order</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={centsToDollars(settings.minimumDeliveryOrderCents)}
                  onChange={(event) =>
                    updateSettings(
                      "minimumDeliveryOrderCents",
                      dollarsToCents(event.target.value),
                    )
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className={labelClass}>Free delivery threshold</span>
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  step="0.01"
                  value={centsToDollars(settings.freeDeliveryThresholdCents)}
                  onChange={(event) =>
                    updateSettings(
                      "freeDeliveryThresholdCents",
                      nullableDollarsToCents(event.target.value),
                    )
                  }
                />
              </label>
            </div>
          </details>

          <details className="rounded-surface border border-[#062F24]/10 bg-white p-5">
            <summary className="cursor-pointer text-base font-extrabold text-[#062F24]">
              Receipt & notifications
            </summary>
            <section className="mt-5">
              <h2 className="text-lg font-extrabold text-[#062F24]">
                Receipt details
              </h2>
              <p className="mt-1 text-sm text-[#062F24]/65">
                These details appear on the customer receipt. Use only approved
                business information.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className={labelClass}>Business legal name</span>
                  <input
                    className={fieldClass}
                    value={settings.receiptLegalName ?? ""}
                    onChange={(event) =>
                      updateSettings(
                        "receiptLegalName",
                        event.target.value || null,
                      )
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className={labelClass}>Receipt phone</span>
                  <input
                    className={fieldClass}
                    type="tel"
                    value={settings.receiptPhone ?? ""}
                    onChange={(event) =>
                      updateSettings("receiptPhone", event.target.value || null)
                    }
                  />
                </label>
                <label className="grid gap-2 md:col-span-2">
                  <span className={labelClass}>Receipt address</span>
                  <input
                    className={fieldClass}
                    value={settings.receiptAddress ?? ""}
                    onChange={(event) =>
                      updateSettings(
                        "receiptAddress",
                        event.target.value || null,
                      )
                    }
                  />
                </label>
                <label className="grid gap-2 md:col-span-2">
                  <span className={labelClass}>Tax registration number</span>
                  <input
                    className={fieldClass}
                    value={settings.receiptTaxRegistration ?? ""}
                    onChange={(event) =>
                      updateSettings(
                        "receiptTaxRegistration",
                        event.target.value || null,
                      )
                    }
                  />
                </label>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-[#062F24]">
                Notifications
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className={labelClass}>Admin SMS recipient</span>
                  <input
                    className={fieldClass}
                    type="tel"
                    value={settings.orderAdminSmsRecipient ?? ""}
                    onChange={(event) =>
                      updateSettings(
                        "orderAdminSmsRecipient",
                        event.target.value.trim() || null,
                      )
                    }
                  />
                </label>
              </div>
            </section>
          </details>

          <details className="rounded-surface border border-[#062F24]/10 bg-white p-5">
            <summary className="cursor-pointer text-base font-extrabold text-[#062F24]">
              Address diagnostic
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 md:col-span-2">
                <span className={labelClass}>Address line 1</span>
                <input
                  className={fieldClass}
                  value={address.addressLine1}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      addressLine1: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-2 md:col-span-2">
                <span className={labelClass}>Address line 2</span>
                <input
                  className={fieldClass}
                  value={address.addressLine2}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      addressLine2: event.target.value,
                    }))
                  }
                />
              </label>
              {(["city", "province", "postalCode", "country"] as const).map(
                (key) => (
                  <label className="grid gap-2" key={key}>
                    <span className={labelClass}>
                      {key === "postalCode" ? "Postal code" : key}
                    </span>
                    <input
                      className={fieldClass}
                      value={address[key]}
                      onChange={(event) =>
                        setAddress((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ),
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={buttonClass}
                onClick={validateAddress}
                disabled={
                  testing || !address.addressLine1 || !address.postalCode
                }
                style={quietButtonStyle}
              >
                {testing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <MapPin size={14} />
                )}
                Validate address
              </button>
              {testResult ? (
                <span className="text-sm font-medium text-[#062F24]/70">
                  {testResult}
                </span>
              ) : null}
            </div>
          </details>
        </div>
      )}
    </AdminPage>
  );
}
