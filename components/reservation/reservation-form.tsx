"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Star,
  User,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";
import type { OccasionKey } from "@/lib/i18n";

const PARTY_SIZES = [5, 6, 7, 8, 9, 10, 11, 12];

type AvailabilitySlot = {
  time: string;
  remainingCapacity: number;
};

type ReservationSuccess = {
  confirmationCode: string;
  manageUrlPath: string;
};

type ApiErrorResponse = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
};

type FormState = {
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone: string;
  email: string;
  occasion: OccasionKey;
  specialRequests: string;
};

const panelClass = "glass-panel rounded-[28px] p-6 sm:p-8 lg:p-10";
const fieldClass =
  "w-full rounded-2xl border bg-[#F8F5EE] px-4 py-3.5 text-base text-[#062F24] placeholder:text-[#062F24]/35 focus:outline-none";
const primaryButtonClass =
  "rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] transition-opacity disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButtonClass =
  "rounded-full border px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.16em]";

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatTime(value: string) {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  const period = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue > 12 ? hourValue - 12 : hourValue === 0 ? 12 : hourValue;

  return {
    hour: `${hour}:${String(minuteValue).padStart(2, "0")}`,
    period,
  };
}

function formatReservationDate(value: string, months: readonly string[], language: "fr" | "en") {
  if (!value) return "";

  const [year, month, day] = value.split("-").map(Number);

  if (language === "fr") {
    return `${day} ${months[month - 1]} ${year}`;
  }

  return `${months[month - 1]} ${day}, ${year}`;
}

function StepIndicator({ step, labels }: { step: number; labels: readonly string[] }) {
  return (
    <div className="mb-12 flex items-center justify-center gap-3 sm:mb-14">
      {[1, 2, 3].map((item) => {
        const complete = step > item;
        const active = step === item;

        return (
          <div key={item} className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all"
              style={{
                background: complete || active ? "#C9A56A" : "rgba(201,165,106,0.16)",
                color: complete || active ? "#062F24" : "rgba(244,232,210,0.6)",
              }}
            >
              {complete ? <CheckCircle2 size={16} /> : item}
            </div>
            <span
              className="hidden text-[11px] font-semibold uppercase tracking-[0.24em] sm:block"
              style={{ color: active ? "#C9A56A" : "rgba(244,232,210,0.42)" }}
            >
              {labels[item - 1]}
            </span>
            {item < 3 ? <div className="mx-1 hidden h-px w-10 sm:block" style={{ background: "rgba(201,165,106,0.16)" }} /> : null}
          </div>
        );
      })}
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
    <label
      className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
      style={{ color: "#062F24" }}
    >
      <Icon size={16} style={{ color: "#C9A56A" }} />
      {children}
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-4 last:border-b-0" style={{ borderColor: "rgba(6,47,36,0.1)" }}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(6,47,36,0.48)" }}>
        {label}
      </span>
      <span className="max-w-[60%] text-right text-sm font-medium leading-relaxed" style={{ color: "#062F24" }}>
        {value}
      </span>
    </div>
  );
}

export default function ReservationForm() {
  const { language, copy } = useTranslation();
  const formCopy = copy.reservation.form;
  const today = new Date();
  const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sectionRef = useRef<HTMLElement | null>(null);
  const stepContentRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);
  const [step, setStep] = useState(1);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [loading, setLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [availabilityError, setAvailabilityError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [reservationSuccess, setReservationSuccess] = useState<ReservationSuccess | null>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({
    date: "",
    time: "",
    partySize: 5,
    name: "",
    phone: "",
    email: "",
    occasion: "none",
    specialRequests: "",
  });

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const stepOneValid = Boolean(form.date && form.time && form.partySize && !availabilityLoading);
  const stepTwoValid = Boolean(form.name.trim() && form.phone.trim());
  const selectedOccasion = formCopy.occasions.find((occasion) => occasion.value === form.occasion);
  const guestLabel = form.partySize > 1 ? formCopy.guestPlural : formCopy.guestSingular;

  useEffect(() => {
    if (!stepContentRef.current) return;

    const updateHeight = () => {
      const nextHeight = stepContentRef.current?.offsetHeight ?? 0;
      if (!nextHeight) return;

      setLockedHeight((currentHeight) => (currentHeight === null ? nextHeight : Math.max(currentHeight, nextHeight)));
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(stepContentRef.current);

    return () => {
      observer.disconnect();
    };
  }, [step]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [step]);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    if (!form.date || !form.partySize) {
      setAvailabilitySlots([]);
      setAvailabilityError("");
      return;
    }

    const controller = new AbortController();

    const loadAvailability = async () => {
      setAvailabilityLoading(true);
      setAvailabilityError("");

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
          setAvailabilitySlots([]);
          setField("time", "");
          setAvailabilityError(result.error?.message ?? formCopy.availabilityError);
          return;
        }

        setAvailabilitySlots(result.data.slots);
        setForm((current) => ({
          ...current,
          time: result.data.slots.some((slot) => slot.time === current.time) ? current.time : "",
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setAvailabilitySlots([]);
        setField("time", "");
        setAvailabilityError(formCopy.availabilityError);
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
  }, [form.date, form.partySize, formCopy.availabilityError]);

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((year) => year - 1);
      return;
    }

    setCalMonth((month) => month - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((year) => year + 1);
      return;
    }

    setCalMonth((month) => month + 1);
  };

  const selectDay = (day: number) => {
    const selectedDate = new Date(calYear, calMonth, day);
    if (selectedDate < minDate) return;

    const formatted = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setForm((current) => ({ ...current, date: formatted, time: "" }));
  };

  const submitReservation = async () => {
    setLoading(true);
    setSubmitError("");

    const occasion = form.occasion !== "none" && selectedOccasion ? selectedOccasion.label : "";
    const specialRequests = [occasion ? `${formCopy.occasion}: ${occasion}` : "", form.specialRequests.trim()]
      .filter(Boolean)
      .join("\n\n");

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: form.date,
          time: form.time,
          partySize: form.partySize,
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          language: language.toUpperCase(),
          specialRequests: specialRequests || undefined,
        }),
      });

      const result = (await response.json()) as
        | {
            ok: true;
            data: {
              reservation: {
                confirmationCode: string;
              };
              manageUrlPath: string;
            };
          }
        | ApiErrorResponse;

      if (!result.ok) {
        setSubmitError(result.error?.message ?? formCopy.submitError);
        return;
      }

      setReservationSuccess({
        confirmationCode: result.data.reservation.confirmationCode,
        manageUrlPath: result.data.manageUrlPath,
      });
      setStep(4);
    } catch {
      setSubmitError(formCopy.submitError);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      date: "",
      time: "",
      partySize: 5,
      name: "",
      phone: "",
      email: "",
      occasion: "none",
      specialRequests: "",
    });
    setReservationSuccess(null);
    setAvailabilitySlots([]);
    setAvailabilityError("");
    setSubmitError("");
    setCalMonth(today.getMonth());
    setCalYear(today.getFullYear());
    setStep(1);
  };

  return (
    <section
      ref={sectionRef}
      className="relative scroll-mt-24 pb-14 pt-28 lg:pb-20 lg:pt-32"
      style={{ background: "#041F18" }}
    >
      <div className="mx-auto mb-10 max-w-7xl px-6 lg:px-8">
        <div className="max-w-7xl">
          <h1
            className="text-5xl font-bold leading-none tracking-tight sm:text-6xl lg:text-7xl"
            style={{ color: "#F4E8D2" }}
          >
            {formCopy.title}
          </h1>

          <p
            className="mt-3 max-w-xl text-sm leading-relaxed sm:text-base"
            style={{ color: "rgba(244,232,210,0.66)" }}
          >
            {formCopy.description}
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-5xl">
          {step < 4 ? <StepIndicator step={step} labels={formCopy.steps} /> : null}

          <div style={{ minHeight: lockedHeight ? `${lockedHeight}px` : undefined }}>
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step-1"
                  ref={stepContentRef}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.28 }}
                >
                  <div className="space-y-6">
                    <div className={panelClass}>
                      <FieldLabel icon={Users}>{formCopy.partySizeLabel}</FieldLabel>
                      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                        {PARTY_SIZES.map((size) => {
                          const selected = form.partySize === size;

                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => {
                                setForm((current) => ({ ...current, partySize: size, time: "" }));
                              }}
                              className="h-14 rounded-2xl text-base font-bold transition-all"
                              data-testid={`party-size-${size}`}
                              style={{
                                background: selected ? "#C9A56A" : "rgba(6,47,36,0.05)",
                                color: "#062F24",
                                border: selected ? "none" : "1px solid rgba(6,47,36,0.12)",
                              }}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-4 text-sm leading-7" style={{ color: "rgba(6,47,36,0.62)" }}>
                        {formCopy.partySizeHint}
                      </p>
                    </div>

                    <div className={panelClass}>
                      <FieldLabel icon={Calendar}>{formCopy.dateLabel}</FieldLabel>
                      <div className="mb-6 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={prevMonth}
                          className="flex h-11 w-11 items-center justify-center rounded-full"
                          style={{ color: "#C9A56A", background: "rgba(201,165,106,0.08)" }}
                          aria-label={formCopy.previousMonth}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <div className="text-lg font-semibold tracking-[0.04em]" style={{ color: "#062F24" }}>
                          {formCopy.months[calMonth]} {calYear}
                        </div>
                        <button
                          type="button"
                          onClick={nextMonth}
                          className="flex h-11 w-11 items-center justify-center rounded-full"
                          style={{ color: "#C9A56A", background: "rgba(201,165,106,0.08)" }}
                          aria-label={formCopy.nextMonth}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {formCopy.weekdaysShort.map((day) => (
                          <div key={day} className="pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(6,47,36,0.45)" }}>
                            {day}
                          </div>
                        ))}
                        {Array.from({ length: firstDay }).map((_, index) => (
                          <div key={`empty-${index}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, index) => {
                          const day = index + 1;
                          const currentDate = new Date(calYear, calMonth, day);
                          const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const isPast = currentDate < minDate;
                          const isSelected = form.date === dateKey;

                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => selectDay(day)}
                              disabled={isPast}
                              className="h-11 rounded-xl text-sm font-semibold transition-all"
                              style={{
                                background: isSelected ? "#C9A56A" : "transparent",
                                color: isPast ? "rgba(6,47,36,0.18)" : isSelected ? "#062F24" : "#062F24",
                                border: isSelected ? "none" : "1px solid rgba(6,47,36,0.08)",
                                cursor: isPast ? "not-allowed" : "pointer",
                              }}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {form.date ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={panelClass}
                      >
                        <FieldLabel icon={Clock}>{formCopy.timeLabel}</FieldLabel>
                        <div className="space-y-6">
                          <div>
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(6,47,36,0.45)" }}>
                              {formCopy.lunch}
                            </p>
                            <p className="rounded-2xl border px-4 py-4 text-sm leading-7" style={{ borderColor: "rgba(6,47,36,0.12)", color: "rgba(6,47,36,0.62)", background: "rgba(6,47,36,0.04)" }}>
                              {formCopy.lunchInfo}
                            </p>
                          </div>

                          <div>
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(6,47,36,0.45)" }}>
                              {formCopy.dinner}
                            </p>
                            {availabilityLoading ? (
                              <div className="flex items-center gap-3 rounded-2xl px-4 py-4 text-sm font-medium" style={{ color: "rgba(6,47,36,0.62)", background: "rgba(6,47,36,0.05)" }}>
                                <Loader2 size={16} className="animate-spin" />
                                {formCopy.availabilityLoading}
                              </div>
                            ) : null}
                            {availabilityError ? (
                              <p className="rounded-2xl border px-4 py-4 text-sm leading-7" style={{ borderColor: "rgba(153,27,27,0.18)", color: "#7F1D1D", background: "rgba(153,27,27,0.06)" }}>
                                {availabilityError}
                              </p>
                            ) : null}
                            {!availabilityLoading && !availabilityError && availabilitySlots.length === 0 ? (
                              <p className="rounded-2xl border px-4 py-4 text-sm leading-7" style={{ borderColor: "rgba(6,47,36,0.12)", color: "rgba(6,47,36,0.62)", background: "rgba(6,47,36,0.04)" }}>
                                {formCopy.noSlots}
                              </p>
                            ) : null}
                            <div className="grid grid-cols-3 gap-3">
                              {availabilitySlots.map((slot) => {
                                const time = slot.time;
                                const { hour, period } = formatTime(time);
                                const selected = form.time === time;

                                return (
                                  <button
                                    key={time}
                                    type="button"
                                    onClick={() => setField("time", time)}
                                    className="rounded-2xl py-4 text-center transition-all"
                                    data-testid={`slot-${time}`}
                                    style={{
                                      background: selected ? "#C9A56A" : "rgba(6,47,36,0.05)",
                                      color: "#062F24",
                                      border: selected ? "none" : "1px solid rgba(6,47,36,0.12)",
                                    }}
                                  >
                                    <div className="text-base font-semibold leading-none">{hour}</div>
                                    <div className="mt-1 text-[11px] font-semibold">{period}</div>
                                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(6,47,36,0.5)" }}>
                                      {slot.remainingCapacity} {formCopy.remaining}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={!stepOneValid}
                      className={primaryButtonClass}
                      style={{ background: "#C9A56A", color: "#062F24" }}
                    >
                      {formCopy.continue}
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {step === 2 ? (
                <motion.div
                  key="step-2"
                  ref={stepContentRef}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.28 }}
                >
                  <div className={panelClass}>
                    <div className="space-y-6">
                      <div>
                        <FieldLabel icon={User}>{formCopy.fullName}</FieldLabel>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(event) => setField("name", event.target.value)}
                          placeholder={formCopy.fullNamePlaceholder}
                          className={fieldClass}
                          style={{ borderColor: "rgba(201,165,106,0.18)" }}
                        />
                      </div>

                      <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                          <FieldLabel icon={Phone}>{formCopy.phone}</FieldLabel>
                          <input
                            type="tel"
                            value={form.phone}
                            onChange={(event) => setField("phone", event.target.value)}
                            placeholder={formCopy.phonePlaceholder}
                            className={fieldClass}
                            style={{ borderColor: "rgba(201,165,106,0.18)" }}
                          />
                        </div>

                        <div>
                          <FieldLabel icon={Mail}>{formCopy.email}</FieldLabel>
                          <input
                            type="email"
                            value={form.email}
                            onChange={(event) => setField("email", event.target.value)}
                            placeholder={formCopy.emailPlaceholder}
                            className={fieldClass}
                            style={{ borderColor: "rgba(201,165,106,0.18)" }}
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel icon={Star}>{formCopy.occasion}</FieldLabel>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {formCopy.occasions.map((occasion) => {
                            const selected = form.occasion === occasion.value;

                            return (
                              <button
                                key={occasion.value}
                                type="button"
                                onClick={() => setField("occasion", occasion.value)}
                                className="rounded-2xl px-3 py-3.5 text-sm font-medium transition-all"
                                style={{
                                  background: selected ? "#C9A56A" : "rgba(6,47,36,0.05)",
                                  color: "#062F24",
                                  border: selected ? "none" : "1px solid rgba(6,47,36,0.12)",
                                }}
                              >
                                {occasion.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <FieldLabel icon={MessageSquare}>{formCopy.specialRequests}</FieldLabel>
                        <textarea
                          rows={4}
                          value={form.specialRequests}
                          onChange={(event) => setField("specialRequests", event.target.value)}
                          placeholder={formCopy.specialRequestsPlaceholder}
                          className={`${fieldClass} resize-none`}
                          style={{ borderColor: "rgba(201,165,106,0.18)" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className={secondaryButtonClass}
                      style={{ borderColor: "rgba(201,165,106,0.18)", color: "#C9A56A" }}
                    >
                      {formCopy.back}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!stepTwoValid}
                      className={primaryButtonClass}
                      style={{ background: "#C9A56A", color: "#062F24" }}
                    >
                      {formCopy.review}
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div
                  key="step-3"
                  ref={stepContentRef}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.28 }}
                >
                  <div className={panelClass}>
                    <DetailRow label={formCopy.summary.date} value={formatReservationDate(form.date, formCopy.months, language)} />
                    <DetailRow label={formCopy.summary.time} value={form.time} />
                    <DetailRow label={formCopy.summary.guests} value={`${form.partySize} ${guestLabel}`} />
                    <DetailRow label={formCopy.summary.name} value={form.name} />
                    <DetailRow label={formCopy.summary.phone} value={form.phone} />
                    {form.email ? <DetailRow label={formCopy.summary.email} value={form.email} /> : null}
                    {form.occasion !== "none" && selectedOccasion ? (
                      <DetailRow label={formCopy.summary.occasion} value={selectedOccasion.label} />
                    ) : null}
                    {form.specialRequests ? <DetailRow label={formCopy.summary.requests} value={form.specialRequests} /> : null}
                  </div>

                  <p className="mt-5 max-w-2xl text-sm leading-7" style={{ color: "rgba(244,232,210,0.58)" }}>
                    {formCopy.reviewNote}
                  </p>

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className={secondaryButtonClass}
                      style={{ borderColor: "rgba(201,165,106,0.18)", color: "#C9A56A" }}
                    >
                      {formCopy.edit}
                    </button>
                    <button
                      type="button"
                      onClick={submitReservation}
                      disabled={loading}
                      className="inline-flex items-center gap-3 rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: "#C9A56A", color: "#062F24" }}
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {formCopy.confirmReservation}
                    </button>
                  </div>
                  {submitError ? (
                    <p className="mt-5 rounded-2xl border px-4 py-4 text-sm leading-7" style={{ borderColor: "rgba(153,27,27,0.18)", color: "#FCA5A5", background: "rgba(153,27,27,0.14)" }}>
                      {submitError}
                    </p>
                  ) : null}
                </motion.div>
              ) : null}

              {step === 4 ? (
                <motion.div
                  key="step-4"
                  ref={stepContentRef}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.28 }}
                  className="text-center"
                >
                  <div
                    className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                    style={{ background: "rgba(201,165,106,0.12)" }}
                  >
                    <CheckCircle2 size={38} style={{ color: "#C9A56A" }} />
                  </div>

                  <p className="text-sm font-semibold uppercase tracking-[0.28em]" style={{ color: "#C9A56A" }}>
                    {formCopy.successEyebrow}
                  </p>
                  <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl" style={{ color: "#F4E8D2" }}>
                    {formCopy.successTitle}
                  </h2>
                  <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 sm:text-base" style={{ color: "rgba(244,232,210,0.66)" }}>
                    {formCopy.successDescription.replace("{phone}", form.phone)}
                  </p>

                  <div className={`${panelClass} mx-auto mt-10 max-w-lg`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "rgba(6,47,36,0.45)" }}>
                      {formCopy.trackingCode}
                    </p>
                    <p className="mt-2 text-3xl font-bold" style={{ color: "#C9A56A" }}>
                      {reservationSuccess?.confirmationCode}
                    </p>

                    <div className="mt-6 text-left">
                      <DetailRow label={formCopy.summary.date} value={formatReservationDate(form.date, formCopy.months, language)} />
                      <DetailRow label={formCopy.summary.time} value={form.time} />
                      <DetailRow label={formCopy.summary.guests} value={`${form.partySize} ${guestLabel}`} />
                      <DetailRow label={formCopy.summary.name} value={form.name} />
                    </div>
                  </div>

                  <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <button
                      type="button"
                      onClick={resetForm}
                      className={secondaryButtonClass}
                      style={{ borderColor: "rgba(201,165,106,0.18)", color: "#C9A56A" }}
                    >
                      {formCopy.anotherReservation}
                    </button>
                    <Link
                      href={reservationSuccess?.manageUrlPath ?? "#"}
                      className="rounded-full px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.16em]"
                      style={{ background: "#C9A56A", color: "#062F24" }}
                    >
                      {formCopy.manageReservation}
                    </Link>
                    <Link
                      href="/"
                      className="rounded-full px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.16em]"
                      style={{ background: "rgba(201,165,106,0.12)", color: "#C9A56A" }}
                    >
                      {formCopy.backHome}
                    </Link>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
