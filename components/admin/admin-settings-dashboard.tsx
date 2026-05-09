"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Settings = {
  slotCapacityGuests: number;
  minPartySize: number;
  maxPartySize: number;
  firstSlot: string;
  lastSlot: string;
  slotIntervalMinutes: number;
  guestModifyCutoffHours: number;
};

type ClosureDate = {
  id: string;
  date: string;
  note: string | null;
};

const fieldClass =
  "w-full rounded border bg-[#F8F5EE] px-3 py-2.5 text-sm text-[#062F24] focus:outline-none";
const buttonClass =
  "rounded px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export default function AdminSettingsDashboard() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [closureDates, setClosureDates] = useState<ClosureDate[]>([]);
  const [closureDate, setClosureDate] = useState("");
  const [closureNote, setClosureNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSettings = async () => {
    setError("");
    const response = await fetch("/api/admin/settings");
    const result = await response.json();

    if (!result.ok) {
      setError(result.error?.message ?? "Unable to load settings.");
      return;
    }

    setSettings(result.data.settings);
    setClosureDates(result.data.closureDates);
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    setNotice("");
    setError("");

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotCapacityGuests: settings.slotCapacityGuests,
        minPartySize: settings.minPartySize,
        maxPartySize: settings.maxPartySize,
      }),
    });
    const result = await response.json();

    if (!result.ok) {
      setError(result.error?.message ?? "Unable to update settings.");
      return;
    }

    setSettings(result.data.settings);
    setNotice("Settings updated.");
  };

  const addClosureDate = async () => {
    setNotice("");
    setError("");

    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: closureDate, note: closureNote || null }),
    });
    const result = await response.json();

    if (!result.ok) {
      setError(result.error?.message ?? "Unable to save closure date.");
      return;
    }

    setClosureDate("");
    setClosureNote("");
    setNotice("Closure date saved.");
    await loadSettings();
  };

  const deleteClosureDate = async (date: string) => {
    const confirmed = window.confirm(`Remove the closure date for ${date}?`);
    if (!confirmed) return;

    await fetch(`/api/admin/settings?date=${encodeURIComponent(date)}`, {
      method: "DELETE",
    });
    await loadSettings();
  };

  return (
    <section className="px-6 pb-20 pt-32" style={{ background: "#041F18" }}>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[#C9A56A]">
              Admin
            </p>
            <h1 className="mt-3 text-5xl font-bold text-[#F4E8D2]">
              Settings
            </h1>
          </div>
          <Link href="/admin/reservations" className={buttonClass} style={{ background: "#C9A56A", color: "#062F24" }}>
            Reservations
          </Link>
        </div>

        {error ? (
          <p className="mt-6 rounded bg-red-900/20 p-4 text-sm text-red-200" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-6 rounded bg-[#C9A56A]/10 p-4 text-sm text-[#C9A56A]" aria-live="polite">
            {notice}
          </p>
        ) : null}

        {settings ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded bg-[#F8F5EE] p-6">
              <h2 className="text-xl font-bold text-[#062F24]">Booking rules</h2>
              <div className="mt-5 grid gap-4">
                <label>
                  <span className="mb-2 block text-xs font-bold text-[#062F24]/60">Slot capacity</span>
                  <input className={fieldClass} type="number" name="slot-capacity-guests" inputMode="numeric" value={settings.slotCapacityGuests} onChange={(event) => setSettings({ ...settings, slotCapacityGuests: Number(event.target.value) })} />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-bold text-[#062F24]/60">Min online party size</span>
                  <input className={fieldClass} type="number" name="min-party-size" inputMode="numeric" value={settings.minPartySize} onChange={(event) => setSettings({ ...settings, minPartySize: Number(event.target.value) })} />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-bold text-[#062F24]/60">Max online party size</span>
                  <input className={fieldClass} type="number" name="max-party-size" inputMode="numeric" value={settings.maxPartySize} onChange={(event) => setSettings({ ...settings, maxPartySize: Number(event.target.value) })} />
                </label>
                <p className="text-sm text-[#062F24]/65">
                  Dinner slots remain {settings.firstSlot}-{settings.lastSlot}, every {settings.slotIntervalMinutes} minutes. Guest cutoff remains {settings.guestModifyCutoffHours} hours.
                </p>
                <button type="button" onClick={saveSettings} className={buttonClass} style={{ background: "#C9A56A", color: "#062F24" }}>
                  Save settings
                </button>
              </div>
            </div>

            <div className="rounded bg-[#F8F5EE] p-6">
              <h2 className="text-xl font-bold text-[#062F24]">Closure dates</h2>
              <div className="mt-5 grid gap-3">
                <label>
                  <span className="mb-2 block text-xs font-bold text-[#062F24]/60">Closure date</span>
                  <input className={fieldClass} type="date" name="closure-date" value={closureDate} onChange={(event) => setClosureDate(event.target.value)} />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-bold text-[#062F24]/60">Note</span>
                  <input className={fieldClass} name="closure-note" placeholder="Private event…" value={closureNote} onChange={(event) => setClosureNote(event.target.value)} />
                </label>
                <button type="button" onClick={addClosureDate} className={buttonClass} style={{ background: "#C9A56A", color: "#062F24" }}>
                  Add closure
                </button>
              </div>
              <div className="mt-6 divide-y divide-[#062F24]/10">
                {closureDates.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-semibold text-[#062F24]">{item.date}</p>
                      {item.note ? <p className="text-sm text-[#062F24]/60">{item.note}</p> : null}
                    </div>
                    <button type="button" onClick={() => deleteClosureDate(item.date)} className={buttonClass} style={{ background: "#FCA5A5", color: "#062F24" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
