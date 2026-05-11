"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useTranslation } from "@/components/providers/language-provider";

type SlotCapacityFormRow = {
  time: string;
  capacityGuests: number;
};

type AdminSettingsResponse = {
  settings: {
    slotCapacities: SlotCapacityFormRow[];
  };
};

const fieldClass =
  "w-full rounded border border-[rgba(6,47,36,0.12)] bg-[rgba(6,47,36,0.05)] px-3 py-2.5 text-sm text-[#062F24] focus:outline-none focus-visible:outline-none focus-visible:outline-0";
const buttonClass =
  "inline-flex items-center justify-center rounded px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50";
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

function normalizeSlotCapacities(slotCapacities: SlotCapacityFormRow[]) {
  return slotCapacities.map((slot) => ({
    time: slot.time,
    capacityGuests: slot.capacityGuests,
  }));
}

function slotCapacitiesSignature(slotCapacities: SlotCapacityFormRow[]) {
  return JSON.stringify(normalizeSlotCapacities(slotCapacities));
}

function chunkSlotCapacities(slotCapacities: SlotCapacityFormRow[], chunkCount: number) {
  if (slotCapacities.length === 0) {
    return [];
  }

  const size = Math.ceil(slotCapacities.length / chunkCount);
  const chunks: SlotCapacityFormRow[][] = [];

  for (let index = 0; index < slotCapacities.length; index += size) {
    chunks.push(slotCapacities.slice(index, index + size));
  }

  return chunks;
}

function formatDisplayTime(time: string, language: "fr" | "en") {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2026, 0, 1, hour, minute);

  return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function AdminSettingsPage() {
  const { language, copy } = useTranslation();
  const settingsCopy = copy.admin.settings;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [initialSlotCapacities, setInitialSlotCapacities] = useState<SlotCapacityFormRow[]>([]);
  const [slotCapacities, setSlotCapacities] = useState<SlotCapacityFormRow[]>([]);

  const hasUnsavedChanges = useMemo(
    () =>
      slotCapacitiesSignature(slotCapacities) !==
      slotCapacitiesSignature(initialSlotCapacities),
    [initialSlotCapacities, slotCapacities],
  );

  const slotCapacityColumns = useMemo(
    () => chunkSlotCapacities(slotCapacities, 2),
    [slotCapacities],
  );

  const formValid = slotCapacities.every(
    (slot) => Number.isInteger(slot.capacityGuests) && slot.capacityGuests > 0,
  );

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/settings", { cache: "no-store" });
        const result = await response.json();

        if (!result.ok) {
          setError(result.error?.message ?? settingsCopy.loadError);
          return;
        }

        const nextSlotCapacities = normalizeSlotCapacities(
          (result.data as AdminSettingsResponse).settings.slotCapacities,
        );

        setInitialSlotCapacities(nextSlotCapacities);
        setSlotCapacities(nextSlotCapacities);
      } catch {
        setError(settingsCopy.loadError);
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, [settingsCopy.loadError]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleCapacityChange = (time: string, value: string) => {
    setSuccess("");

    setSlotCapacities((current) =>
      current.map((slot) =>
        slot.time === time
          ? {
              ...slot,
              capacityGuests: Number(value),
            }
          : slot,
      ),
    );
  };

  const discardChanges = () => {
    setSlotCapacities(normalizeSlotCapacities(initialSlotCapacities));
    setError("");
    setSuccess("");
  };

  const saveChanges = async () => {
    if (!hasUnsavedChanges || !formValid) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotCapacities: slotCapacities.map((slot) => ({
            time: slot.time,
            capacityGuests: slot.capacityGuests,
          })),
        }),
      });
      const result = await response.json();

      if (!result.ok) {
        setError(result.error?.message ?? settingsCopy.saveError);
        return;
      }

      const nextSlotCapacities = normalizeSlotCapacities(
        (result.data as AdminSettingsResponse).settings.slotCapacities,
      );

      setInitialSlotCapacities(nextSlotCapacities);
      setSlotCapacities(nextSlotCapacities);
      setSuccess(settingsCopy.saveSuccess);
    } catch {
      setError(settingsCopy.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pb-20 pt-36 lg:pt-40" style={{ background: "#FFFFFF" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div>
          <Link
            href="/admin/reservations"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#062F24]/70 transition hover:text-[#062F24]"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {settingsCopy.backToReservations}
          </Link>
          <h1 className="mt-4 text-3xl font-extrabold leading-none text-[#062F24]">
            {settingsCopy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#062F24]/65">
            {settingsCopy.description}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={buttonClass}
              onClick={discardChanges}
              disabled={!hasUnsavedChanges || saving}
              style={quietButtonStyle}
            >
              {settingsCopy.discard}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={saveChanges}
              disabled={!hasUnsavedChanges || !formValid || saving}
              style={primaryButtonStyle}
            >
              {saving ? <Loader2 size={14} className="mr-2 inline animate-spin" aria-hidden="true" /> : null}
              {saving ? settingsCopy.saving : settingsCopy.saveChanges}
            </button>
        </div>

        {error ? (
          <p
            className="mt-6 rounded border border-red-900/20 bg-red-900/10 p-4 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {success ? (
          <p
            className="mt-6 rounded border border-emerald-900/20 bg-emerald-900/10 p-4 text-sm text-emerald-800"
            role="status"
          >
            {success}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-8 flex items-center gap-3 rounded border border-[#062F24]/10 bg-white p-6 text-[#062F24] shadow-sm">
            <Loader2 size={16} className="animate-spin" />
            {settingsCopy.loading}
          </div>
        ) : (
          <section className="mt-8">
            <div>
              <div className="hidden md:grid md:grid-cols-2 md:gap-4">
                {slotCapacityColumns.map((_, index) => (
                  <div
                    key={`header-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_160px] gap-4 rounded border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#062F24]/45"
                  >
                    <span>{settingsCopy.time}</span>
                    <span>{settingsCopy.capacity}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {slotCapacityColumns.map((column, columnIndex) => (
                  <div
                    key={`column-${columnIndex}`}
                    className="overflow-hidden rounded border border-[#062F24]/10"
                  >
                    <div className="border-b border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] px-4 py-3 md:hidden">
                      <div className="grid grid-cols-[minmax(0,1fr)_132px] gap-4 text-xs font-bold uppercase tracking-[0.14em] text-[#062F24]/45">
                        <span>{settingsCopy.time}</span>
                        <span>{settingsCopy.capacity}</span>
                      </div>
                    </div>

                    <div className="divide-y divide-[#062F24]/10 bg-white">
                      {column.map((slot) => (
                        <div
                          key={slot.time}
                          className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_160px]"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#062F24]">
                              {formatDisplayTime(slot.time, language)}
                            </p>
                            <p className="mt-1 text-xs font-medium text-[#062F24]/50">
                              {slot.time}
                            </p>
                          </div>

                          <div>
                            <input
                              aria-label={`${settingsCopy.capacity} ${slot.time}`}
                              className={`${fieldClass} text-center font-semibold`}
                              type="number"
                              min={1}
                              inputMode="numeric"
                              value={Number.isNaN(slot.capacityGuests) ? "" : slot.capacityGuests}
                              onChange={(event) =>
                                handleCapacityChange(slot.time, event.target.value)
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
