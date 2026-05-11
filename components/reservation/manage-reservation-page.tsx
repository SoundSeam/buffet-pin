"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
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

const PARTY_SIZES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const panelClass =
  "rounded border border-[rgba(6,47,36,0.08)] bg-white p-6 shadow-sm sm:p-8 lg:p-10";
const fieldClass =
  "w-full rounded border bg-[rgba(6,47,36,0.05)] px-4 py-3.5 text-base text-[#062F24] placeholder:text-[#062F24]/35 focus:outline-none focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-70";
const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-3 rounded px-6 py-4 text-base font-extrabold transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex w-full items-center justify-center rounded border px-6 py-4 text-base font-semibold transition-all duration-300 hover:bg-[rgba(6,47,36,0.03)] focus-visible:outline-none focus-visible:outline-0";

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

function formatPhoneNumber(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return trimmed;
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
        className="text-sm font-semibold uppercase"
        style={{ color: "rgba(6,47,36,0.48)" }}
      >
        {label}
      </span>
      <span
        className="max-w-[60%] text-right text-base font-medium leading-relaxed"
        style={{ color: "#062F24" }}
      >
        {value}
      </span>
    </div>
  );
}

function FieldLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Calendar;
  children: string;
}) {
  return (
    <span
      className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase"
      style={{ color: "#062F24" }}
    >
      <Icon size={15} style={{ color: "#6B7280" }} />
      {children}
    </span>
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
          color: "#7F1D1D",
          background: "rgba(153,27,27,0.06)",
        }
      : tone === "success"
        ? {
            borderColor: "rgba(6,47,36,0.12)",
            color: "#062F24",
            background: "rgba(6,47,36,0.04)",
          }
        : {
            borderColor: "rgba(6,47,36,0.12)",
            color: "rgba(6,47,36,0.66)",
            background: "rgba(6,47,36,0.04)",
          };

  return (
    <p className="rounded border px-4 py-4 text-sm leading-7" style={style}>
      {children}
    </p>
  );
}

export default function ManageReservationPage({ token }: { token: string }) {
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
  const formattedPhone = reservation ? formatPhoneNumber(reservation.guest.phone) : "";

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
      className="relative scroll-mt-24 pb-14 pt-36 lg:pb-20 lg:pt-40"
      style={{ background: "#FFFFFF" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-10">
          <h1
            className="text-3xl font-extrabold leading-none"
            style={{ color: "#062F24" }}
          >
            Manage your reservation
          </h1>
          <p
            className="mt-3 max-w-xl text-sm leading-relaxed"
            style={{ color: "rgba(6,47,36,0.66)" }}
          >
            Review, update, or cancel your booking using your private manage link.
          </p>
        </div>

        {loading ? (
          <div className={`${panelClass} flex items-center gap-3`}>
            <Loader2 size={18} className="animate-spin" style={{ color: "#062F24" }} />
            <span className="text-sm font-medium" style={{ color: "#062F24" }}>
              Loading reservation...
            </span>
          </div>
        ) : null}

        {!loading && error && !reservation ? (
          <div className="max-w-2xl space-y-6">
            <MessageBox tone="error">{error}</MessageBox>
            <Link
              href="/reservation"
              className={`${primaryButtonClass} focus-visible:outline-none focus-visible:outline-0`}
              style={{ background: "#062F24", border: "1px solid #062F24", color: "#FFFFFF" }}
            >
              Make a reservation
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : null}

        {!loading && reservation && form ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
            <div className={panelClass}>
              <p className="text-[11px] font-semibold uppercase" style={{ color: "rgba(6,47,36,0.45)" }}>
                Confirmation number
              </p>
              <p className="mt-2 text-3xl font-bold" style={{ color: "#062F24" }}>
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
                <DetailRow label="Phone" value={formattedPhone} />
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

              <div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block focus-within:shadow-none">
                    <FieldLabel icon={Calendar}>Date</FieldLabel>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(event) => {
                        setField("date", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(6,47,36,0.12)" }}
                    />
                  </label>

                  <label className="block focus-within:shadow-none">
                    <FieldLabel icon={Clock}>Time</FieldLabel>
                    <select
                      value={form.time}
                      onChange={(event) => {
                        setField("time", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed || availabilityLoading}
                      className={fieldClass}
                      style={{ borderColor: "rgba(6,47,36,0.12)" }}
                    >
                      {slots.map((slot) => (
                        <option key={slot.time} value={slot.time}>
                          {formatDisplayTime(slot.time)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block focus-within:shadow-none">
                    <FieldLabel icon={Users}>Party size</FieldLabel>
                    <select
                      value={form.partySize}
                      onChange={(event) => {
                        setField("partySize", Number(event.target.value));
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(6,47,36,0.12)" }}
                    >
                      {PARTY_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block focus-within:shadow-none">
                    <FieldLabel icon={CheckCircle2}>Name</FieldLabel>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => {
                        setField("name", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(6,47,36,0.12)" }}
                    />
                  </label>

                  <label className="block focus-within:shadow-none">
                    <FieldLabel icon={Phone}>Phone</FieldLabel>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => {
                        setField("phone", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(6,47,36,0.12)" }}
                    />
                  </label>

                  <label className="block focus-within:shadow-none">
                    <FieldLabel icon={Mail}>Email</FieldLabel>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => {
                        setField("email", event.target.value);
                      }}
                      disabled={!reservation.editingAllowed}
                      className={fieldClass}
                      style={{ borderColor: "rgba(6,47,36,0.12)" }}
                    />
                  </label>
                </div>

                <label className="mt-5 block focus-within:shadow-none">
                  <FieldLabel icon={MessageSquare}>Special requests</FieldLabel>
                  <textarea
                    rows={4}
                    value={form.specialRequests}
                    onChange={(event) => {
                      setField("specialRequests", event.target.value);
                    }}
                    disabled={!reservation.editingAllowed}
                    className={fieldClass}
                    style={{ borderColor: "rgba(6,47,36,0.12)" }}
                  />
                </label>

                {availabilityLoading ? (
                  <p
                    className="mt-4 flex items-center gap-2 text-sm"
                    style={{ color: "rgba(6,47,36,0.6)" }}
                  >
                    <Loader2 size={15} className="animate-spin" />
                    Checking available times...
                  </p>
                ) : null}

                {!selectedSlotAvailable && reservation.editingAllowed ? (
                  <p
                    className="mt-4 flex items-center gap-2 text-sm"
                    style={{ color: "#7F1D1D" }}
                  >
                    <AlertCircle size={15} />
                    Select an available time before saving.
                  </p>
                ) : null}

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
                    style={{ background: "#062F24", border: "1px solid #062F24", color: "#FFFFFF" }}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    Save changes
                    {!saving ? <ArrowRight size={18} /> : null}
                  </button>
                  <button
                    type="button"
                    onClick={cancelReservation}
                    disabled={!reservation.editingAllowed || saving || cancelling}
                    className={secondaryButtonClass}
                    style={{ borderColor: "rgba(153,27,27,0.18)", color: "#7F1D1D" }}
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
