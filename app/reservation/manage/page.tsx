"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Users,
} from "lucide-react";

import { useTranslation } from "@/components/providers/language-provider";
import SiteShell from "@/components/site-shell";

type ManagedReservation = {
  id: string;
  confirmationCode: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  date: string;
  time: string;
  reservationAt: string;
  cutoffAt: string;
  editingAllowed: boolean;
  partySize: number;
  guest: {
    name: string;
    phone: string;
    email: string | null;
    language: "EN" | "FR";
  };
  specialRequests: string | null;
  cancelledAt: string | null;
};

type AvailabilitySlot = {
  time: string;
  remainingCapacity: number;
};

type FormState = {
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone: string;
  email: string;
  specialRequests: string;
};

type ApiErrorResponse = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
};

const PARTY_SIZES = [5, 6, 7, 8, 9, 10, 11, 12];

const panelClass = "glass-panel rounded-[28px] p-6 sm:p-8 lg:p-10";
const fieldClass =
  "w-full rounded-2xl border bg-[#F8F5EE] px-4 py-3.5 text-base text-[#062F24] placeholder:text-[#062F24]/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-3 rounded-full px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] transition-opacity disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-full border px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.16em]";

function formatDisplayDate(value: string, language: "fr" | "en") {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDisplayTime(value: string) {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  const period = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue > 12 ? hourValue - 12 : hourValue === 0 ? 12 : hourValue;
  return `${hour}:${String(minuteValue).padStart(2, "0")} ${period}`;
}

function toFormState(reservation: ManagedReservation): FormState {
  return {
    date: reservation.date,
    time: reservation.time,
    partySize: reservation.partySize,
    name: reservation.guest.name,
    phone: reservation.guest.phone,
    email: reservation.guest.email ?? "",
    specialRequests: reservation.specialRequests ?? "",
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-start justify-between gap-4 border-b py-4 last:border-b-0"
      style={{ borderColor: "rgba(6,47,36,0.1)" }}
    >
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "rgba(6,47,36,0.48)" }}
      >
        {label}
      </span>
      <span
        className="max-w-[60%] text-right text-sm font-medium leading-relaxed"
        style={{ color: "#062F24" }}
      >
        {value}
      </span>
    </div>
  );
}

function MessageBox({
  tone,
  children,
}: {
  tone: "error" | "info" | "success";
  children: string;
}) {
  const style =
    tone === "error"
      ? {
          borderColor: "rgba(153,27,27,0.18)",
          color: "#FCA5A5",
          background: "rgba(153,27,27,0.14)",
        }
      : tone === "success"
        ? {
            borderColor: "rgba(201,165,106,0.18)",
            color: "#C9A56A",
            background: "rgba(201,165,106,0.12)",
          }
        : {
            borderColor: "rgba(201,165,106,0.18)",
            color: "rgba(244,232,210,0.72)",
            background: "rgba(201,165,106,0.08)",
          };

  return (
    <p className="rounded-2xl border px-4 py-4 text-sm leading-7" style={style}>
      {children}
    </p>
  );
}

function ManageReservationContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { language } = useTranslation();
  const [reservation, setReservation] = useState<ManagedReservation | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedSlotAvailable = useMemo(() => {
    if (!form?.time) return false;
    return slots.some((slot) => slot.time === form.time);
  }, [form?.time, slots]);

  useEffect(() => {
    if (!token) {
      setError("Missing manage token. Please use the link from your confirmation.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadReservation = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/reservations/manage?token=${encodeURIComponent(token)}`,
          {
            signal: controller.signal,
          },
        );
        const result = (await response.json()) as
          | {
              ok: true;
              data: {
                reservation: ManagedReservation;
              };
            }
          | ApiErrorResponse;

        if (!result.ok) {
          setError(result.error?.message ?? "Reservation not found.");
          setReservation(null);
          setForm(null);
          return;
        }

        setReservation(result.data.reservation);
        setForm(toFormState(result.data.reservation));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError("Unable to load this reservation.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadReservation();

    return () => {
      controller.abort();
    };
  }, [token]);

  useEffect(() => {
    if (!form || !reservation?.editingAllowed) {
      setSlots([]);
      return;
    }

    const controller = new AbortController();

    const loadAvailability = async () => {
      setAvailabilityLoading(true);

      try {
        const response = await fetch("/api/reservations/availability", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: form.date,
            partySize: form.partySize,
          }),
          signal: controller.signal,
        });
        const result = (await response.json()) as
          | {
              ok: true;
              data: {
                slots: AvailabilitySlot[];
              };
            }
          | ApiErrorResponse;

        if (!result.ok) {
          setSlots([{ time: form.time, remainingCapacity: form.partySize }]);
          return;
        }

        const nextSlots = result.data.slots.some((slot) => slot.time === form.time)
          ? result.data.slots
          : [
              {
                time: form.time,
                remainingCapacity: form.partySize,
              },
              ...result.data.slots,
            ];

        setSlots(nextSlots);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setSlots([{ time: form.time, remainingCapacity: form.partySize }]);
      } finally {
        if (!controller.signal.aborted) {
          setAvailabilityLoading(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      controller.abort();
    };
  }, [form?.date, form?.partySize, form?.time, reservation?.editingAllowed]);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const saveReservation = async () => {
    if (!form || !token) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/reservations/manage", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          date: form.date,
          time: form.time,
          partySize: form.partySize,
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          specialRequests: form.specialRequests || null,
        }),
      });
      const result = (await response.json()) as
        | {
            ok: true;
            data: {
              reservation: ManagedReservation;
            };
          }
        | ApiErrorResponse;

      if (!result.ok) {
        setError(result.error?.message ?? "Unable to update reservation.");
        return;
      }

      setReservation(result.data.reservation);
      setForm(toFormState(result.data.reservation));
      setNotice("Reservation updated.");
    } catch {
      setError("Unable to update reservation.");
    } finally {
      setSaving(false);
    }
  };

  const cancelReservation = async () => {
    if (!token) return;

    setCancelling(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/reservations/manage?token=${encodeURIComponent(token)}`,
        {
          method: "DELETE",
        },
      );
      const result = (await response.json()) as
        | {
            ok: true;
            data: {
              reservation: ManagedReservation;
            };
          }
        | ApiErrorResponse;

      if (!result.ok) {
        setError(result.error?.message ?? "Unable to cancel reservation.");
        return;
      }

      setReservation(result.data.reservation);
      setForm(toFormState(result.data.reservation));
      setNotice("Reservation cancelled.");
    } catch {
      setError("Unable to cancel reservation.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section
      className="relative scroll-mt-24 pb-14 pt-28 lg:pb-20 lg:pt-32"
      style={{ background: "#041F18" }}
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mb-10">
          <p
            className="text-sm font-semibold uppercase tracking-[0.28em]"
            style={{ color: "#C9A56A" }}
          >
            Reservation
          </p>
          <h1
            className="mt-3 text-5xl font-bold leading-none tracking-tight sm:text-6xl"
            style={{ color: "#F4E8D2" }}
          >
            Manage your reservation
          </h1>
          <p
            className="mt-4 max-w-2xl text-sm leading-7 sm:text-base"
            style={{ color: "rgba(244,232,210,0.66)" }}
          >
            Review, update, or cancel your booking using your private manage link.
          </p>
        </div>

        {loading ? (
          <div className={`${panelClass} flex items-center gap-3`}>
            <Loader2 size={18} className="animate-spin" style={{ color: "#C9A56A" }} />
            <span className="text-sm font-medium" style={{ color: "#062F24" }}>
              Loading reservation...
            </span>
          </div>
        ) : null}

        {!loading && error && !reservation ? (
          <div className="space-y-6">
            <MessageBox tone="error">{error}</MessageBox>
            <Link
              href="/reservation"
              className={primaryButtonClass}
              style={{ background: "#C9A56A", color: "#062F24" }}
            >
              Make a reservation
            </Link>
          </div>
        ) : null}

        {!loading && reservation && form ? (
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className={panelClass}>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.24em]"
                style={{ color: "rgba(6,47,36,0.45)" }}
              >
                Confirmation
              </p>
              <p className="mt-2 text-3xl font-bold" style={{ color: "#C9A56A" }}>
                {reservation.confirmationCode}
              </p>

              <div className="mt-6">
                <DetailRow
                  label="Date"
                  value={formatDisplayDate(reservation.date, language)}
                />
                <DetailRow label="Time" value={formatDisplayTime(reservation.time)} />
                <DetailRow
                  label="Guests"
                  value={`${reservation.partySize} guest${reservation.partySize === 1 ? "" : "s"}`}
                />
                <DetailRow label="Name" value={reservation.guest.name} />
                <DetailRow label="Phone" value={reservation.guest.phone} />
                {reservation.guest.email ? (
                  <DetailRow label="Email" value={reservation.guest.email} />
                ) : null}
                <DetailRow label="Status" value={reservation.status} />
              </div>
            </div>

            <div className="space-y-6">
              {notice ? <MessageBox tone="success">{notice}</MessageBox> : null}
              {error ? <MessageBox tone="error">{error}</MessageBox> : null}
              {!reservation.editingAllowed && reservation.status !== "CANCELLED" ? (
                <MessageBox tone="info">
                  Online changes are closed for this reservation. Please call the restaurant at (450) 699-8088.
                </MessageBox>
              ) : null}
              {reservation.status === "CANCELLED" ? (
                <MessageBox tone="info">
                  This reservation has been cancelled. Please create a new reservation if you need another booking.
                </MessageBox>
              ) : null}

              <div className={panelClass}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span
                      className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "#062F24" }}
                    >
                      <Calendar size={15} style={{ color: "#C9A56A" }} />
                      Date
                    </span>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(event) => {
                        setField("date", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(201,165,106,0.18)" }}
                    />
                  </label>

                  <label className="block">
                    <span
                      className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "#062F24" }}
                    >
                      <Clock size={15} style={{ color: "#C9A56A" }} />
                      Time
                    </span>
                    <select
                      value={form.time}
                      onChange={(event) => {
                        setField("time", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed || availabilityLoading}
                      className={fieldClass}
                      style={{ borderColor: "rgba(201,165,106,0.18)" }}
                    >
                      {slots.map((slot) => (
                        <option key={slot.time} value={slot.time}>
                          {formatDisplayTime(slot.time)} - {slot.remainingCapacity} left
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span
                      className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "#062F24" }}
                    >
                      <Users size={15} style={{ color: "#C9A56A" }} />
                      Party size
                    </span>
                    <select
                      value={form.partySize}
                      onChange={(event) => {
                        setField("partySize", Number(event.target.value));
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(201,165,106,0.18)" }}
                    >
                      {PARTY_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span
                      className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "#062F24" }}
                    >
                      <CheckCircle2 size={15} style={{ color: "#C9A56A" }} />
                      Name
                    </span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => {
                        setField("name", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(201,165,106,0.18)" }}
                    />
                  </label>

                  <label className="block">
                    <span
                      className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "#062F24" }}
                    >
                      <Phone size={15} style={{ color: "#C9A56A" }} />
                      Phone
                    </span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => {
                        setField("phone", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(201,165,106,0.18)" }}
                    />
                  </label>

                  <label className="block">
                    <span
                      className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "#062F24" }}
                    >
                      <Mail size={15} style={{ color: "#C9A56A" }} />
                      Email
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => {
                        setField("email", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(201,165,106,0.18)" }}
                    />
                  </label>
                </div>

                <label className="mt-5 block">
                  <span
                    className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: "#062F24" }}
                  >
                    <MessageSquare size={15} style={{ color: "#C9A56A" }} />
                    Special requests
                  </span>
                  <textarea
                    rows={4}
                    value={form.specialRequests}
                    onChange={(event) => {
                      setField("specialRequests", event.target.value);
                    }}
                    disabled={!reservation.editingAllowed}
                    className={`${fieldClass} resize-none`}
                    style={{ borderColor: "rgba(201,165,106,0.18)" }}
                  />
                </label>

                {availabilityLoading ? (
                  <p
                    className="mt-4 flex items-center gap-2 text-sm"
                    style={{ color: "rgba(6,47,36,0.62)" }}
                  >
                    <Loader2 size={15} className="animate-spin" />
                    Checking available dinner slots...
                  </p>
                ) : null}

                {!selectedSlotAvailable && reservation.editingAllowed ? (
                  <p
                    className="mt-4 flex items-center gap-2 text-sm"
                    style={{ color: "#7F1D1D" }}
                  >
                    <AlertCircle size={15} />
                    Select an available dinner slot before saving.
                  </p>
                ) : null}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={saveReservation}
                    disabled={
                      !reservation.editingAllowed ||
                      !selectedSlotAvailable ||
                      saving ||
                      cancelling
                    }
                    className={primaryButtonClass}
                    style={{ background: "#C9A56A", color: "#062F24" }}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={cancelReservation}
                    disabled={!reservation.editingAllowed || saving || cancelling}
                    className={secondaryButtonClass}
                    style={{ borderColor: "rgba(153,27,27,0.28)", color: "#FCA5A5" }}
                  >
                    {cancelling ? <Loader2 size={16} className="animate-spin" /> : null}
                    Cancel reservation
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ManageReservationPage() {
  return (
    <SiteShell>
      <Suspense fallback={null}>
        <ManageReservationContent />
      </Suspense>
    </SiteShell>
  );
}
