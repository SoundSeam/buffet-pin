"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Star,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";
import type { OccasionKey } from "@/lib/i18n";

const PARTY_SIZES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

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

const panelClass =
  "rounded-surface border border-[rgba(6,47,36,0.08)] bg-white p-6 shadow-sm sm:p-8 lg:p-10";
const selectionPanelClass =
  "rounded-surface border border-[rgba(6,47,36,0.08)] bg-white p-6 shadow-sm sm:p-8 lg:p-10";
const fieldClass =
  "w-full rounded-button border bg-[rgba(6,47,36,0.05)] px-4 py-3.5 text-base text-[#062F24] placeholder:text-[#062F24]/35 focus:outline-none";
const primaryActionButtonClass =
  "inline-flex w-full items-center justify-center gap-3 rounded-button px-6 py-4 text-center text-base font-extrabold transition-all duration-300 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryActionButtonClass =
  "inline-flex items-center justify-center rounded-button border px-6 py-4 text-base font-semibold transition-all duration-300 hover:bg-[rgba(6,47,36,0.03)]";

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

function StepIndicator({ step, labels }: { step: number; labels: readonly string[] }) {
  return (
    <div className="mb-10 flex items-center justify-center gap-3 sm:mb-12">
      {[1, 2, 3].map((item) => {
        const complete = step > item;
        const active = step === item;

        return (
          <div key={item} className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold transition-all"
              style={{
                background: complete || active ? "#062F24" : "#E5E7EB",
                color: complete || active ? "#F8F5EE" : "#6B7280",
              }}
            >
              {complete ? <CheckCircle2 size={16} /> : item}
            </div>
            <span
              className="hidden text-sm font-medium sm:block"
              style={{ color: active ? "#062F24" : "#6B7280" }}
            >
              {labels[item - 1]}
            </span>
            {item < 3 ? <div className="mx-1 hidden h-px w-10 sm:block" style={{ background: "#D1D5DB" }} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({
  icon: Icon,
  children,
  iconColor = "#6B7280",
}: {
  icon: typeof Calendar;
  children: string;
  iconColor?: string;
}) {
  return (
    <label
      className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase"
      style={{ color: "#062F24" }}
    >
      <Icon size={16} style={{ color: iconColor }} />
      {children}
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-4 last:border-b-0" style={{ borderColor: "rgba(6,47,36,0.1)" }}>
      <span className="text-sm font-semibold uppercase" style={{ color: "rgba(6,47,36,0.48)" }}>
        {label}
      </span>
      <span className="max-w-[60%] text-right text-base font-medium leading-relaxed" style={{ color: "#062F24" }}>
        {value}
      </span>
    </div>
  );
}

function InfoNotice({ children }: { children: string }) {
  return (
    <div
      className="flex items-start gap-3 rounded-button border px-4 py-3.5 text-xs leading-relaxed"
      style={{
        borderColor: "rgba(6,47,36,0.12)",
        color: "rgba(6,47,36,0.72)",
        background: "rgba(6,47,36,0.04)",
      }}
    >
      <Info
        size={16}
        className="mt-1 shrink-0"
        style={{ color: "rgba(6,47,36,0.66)" }}
        aria-hidden="true"
      />
      <span>{children}</span>
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
    partySize: 6,
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
  const pageTitle =
    step === 2 ? formCopy.stepTwoTitle : step === 3 ? formCopy.stepThreeTitle : formCopy.title;
  const pageDescription =
    step === 2
      ? formCopy.stepTwoDescription
      : step === 3
        ? formCopy.stepThreeDescription
        : formCopy.description;
  const selectedOccasion = formCopy.occasions.find((occasion) => occasion.value === form.occasion);
  const guestLabel = form.partySize > 1 ? formCopy.guestPlural : formCopy.guestSingular;
  const formattedPhone = formatPhoneNumber(form.phone);

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
    const specialRequests = [
      occasion ? `${formCopy.occasion}: ${occasion}` : "",
      form.specialRequests.trim(),
    ]
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
      partySize: 6,
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
      className="relative scroll-mt-24 pb-14 pt-36 lg:pb-20 lg:pt-40"
      style={{ background: "#FFFFFF" }}
    >
      <div className="mx-auto mb-10 max-w-2xl px-6 lg:px-8">
        {step < 4 ? <StepIndicator step={step} labels={formCopy.steps} /> : null}

        {step < 4 ? (
          <div className="max-w-2xl">
            <h1
              className="text-3xl font-extrabold leading-none"
              style={{ color: "#062F24" }}
            >
              {pageTitle}
            </h1>

            <p
              className="mt-3 max-w-xl text-sm leading-relaxed"
              style={{ color: "rgba(6,47,36,0.66)" }}
            >
              {pageDescription}
            </p>
          </div>
        ) : null}

        <div className={`${step < 4 ? "mt-8" : "mt-0"} w-full max-w-2xl`}>
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
                  <div className="space-y-8">
                    <div className="pt-3">
                      <div className="mb-5 text-left text-base font-semibold leading-none" style={{ color: "#062F24" }}>
                        {formCopy.partySizeLabel}
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {PARTY_SIZES.map((size) => {
                          const selected = form.partySize === size;

                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => {
                                setForm((current) => ({ ...current, partySize: size, time: "" }));
                              }}
                              className="h-12 rounded-button text-base font-extrabold transition-all"
                              data-testid={`party-size-${size}`}
                              style={{
                                background: selected ? "#062F24" : "rgba(6,47,36,0.05)",
                                color: selected ? "#F8F5EE" : "#062F24",
                                border: selected ? "none" : "1px solid rgba(6,47,36,0.12)",
                              }}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-4 text-xs leading-relaxed text-gray-500">
                        {formCopy.partySizeNote}
                      </p>
                    </div>

                    <div className={selectionPanelClass}>
                      <div className="mb-6 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={prevMonth}
                          className="flex h-11 w-11 items-center justify-center rounded-icon transition-colors hover:bg-[rgba(6,47,36,0.05)]"
                          style={{ color: "#062F24" }}
                          aria-label={formCopy.previousMonth}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <div className="text-base font-semibold" style={{ color: "#062F24" }}>
                          {formCopy.months[calMonth]} {calYear}
                        </div>
                        <button
                          type="button"
                          onClick={nextMonth}
                          className="flex h-11 w-11 items-center justify-center rounded-icon transition-colors hover:bg-[rgba(6,47,36,0.05)]"
                          style={{ color: "#062F24" }}
                          aria-label={formCopy.nextMonth}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {formCopy.weekdaysShort.map((day) => (
                          <div key={day} className="pb-2 text-center text-[11px] font-semibold uppercase" style={{ color: "rgba(6,47,36,0.45)" }}>
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
                              className="h-11 rounded-button text-sm font-semibold transition-all"
                              style={{
                                background: isSelected ? "#062F24" : "transparent",
                                color: isPast ? "rgba(6,47,36,0.18)" : isSelected ? "#F8F5EE" : "#062F24",
                                border: isSelected ? "none" : "1px solid rgba(6,47,36,0.12)",
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
                        className=""
                      >
                        <div className="space-y-6">
                          <div>
                            {availabilityLoading ? (
                              <div className="flex items-center gap-3 rounded-surface px-4 py-4 text-sm font-medium" style={{ color: "rgba(6,47,36,0.62)", background: "rgba(6,47,36,0.05)" }}>
                                <Loader2 size={16} className="animate-spin" />
                                {formCopy.availabilityLoading}
                              </div>
                            ) : null}
                            {availabilityError ? (
                              <p className="rounded-surface border px-4 py-4 text-sm leading-7" style={{ borderColor: "rgba(153,27,27,0.18)", color: "#7F1D1D", background: "rgba(153,27,27,0.06)" }}>
                                {availabilityError}
                              </p>
                            ) : null}
                            {!availabilityLoading && !availabilityError && availabilitySlots.length === 0 ? (
                              <p className="rounded-surface border px-4 py-4 text-sm leading-7" style={{ borderColor: "rgba(6,47,36,0.12)", color: "rgba(6,47,36,0.62)", background: "rgba(6,47,36,0.04)" }}>
                                {formCopy.noSlots}
                              </p>
                            ) : null}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              {availabilitySlots.map((slot) => {
                                const time = slot.time;
                                const { hour, period } = formatTime(time);
                                const selected = form.time === time;

                                return (
                                  <button
                                    key={time}
                                    type="button"
                                    onClick={() => setField("time", time)}
                                    className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-button py-3.5 text-center transition-all"
                                    data-testid={`slot-${time}`}
                                    style={{
                                      background: selected ? "#062F24" : "rgba(6,47,36,0.05)",
                                      color: selected ? "#F8F5EE" : "#062F24",
                                      border: selected ? "none" : "1px solid rgba(6,47,36,0.12)",
                                    }}
                                  >
                                    <div className="text-base font-semibold leading-none">{hour}</div>
                                    <div className="text-[11px] font-semibold leading-none">{period}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>

                  {form.partySize >= 6 ? (
                    <div className="mt-8">
                      <InfoNotice>{formCopy.serviceFeeNotice}</InfoNotice>
                    </div>
                  ) : null}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={!stepOneValid}
                      className="inline-flex w-full items-center justify-center gap-3 rounded-button px-6 py-4 text-center text-base font-extrabold transition-all duration-300 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ background: "#062F24", border: "1px solid #062F24", color: "#FFFFFF" }}
                    >
                      {formCopy.continue}
                      <ArrowRight size={18} />
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
                  <div>
                    <div className="space-y-6">
                      <div>
                        <FieldLabel icon={User}>{formCopy.fullName}</FieldLabel>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(event) => setField("name", event.target.value)}
                          placeholder={formCopy.fullNamePlaceholder}
                          className={fieldClass}
                          style={{ borderColor: "rgba(6,47,36,0.12)" }}
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
                            style={{ borderColor: "rgba(6,47,36,0.12)" }}
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
                            style={{ borderColor: "rgba(6,47,36,0.12)" }}
                          />
                        </div>
                      </div>

                      <div>
                        <FieldLabel icon={Star}>{formCopy.occasion}</FieldLabel>
                        <div className="grid grid-cols-2 gap-3">
                          {formCopy.occasions.map((occasion) => {
                            const selected = form.occasion === occasion.value;

                            return (
                              <button
                                key={occasion.value}
                                type="button"
                                onClick={() => setField("occasion", occasion.value)}
                                className="rounded-button px-3 py-3.5 text-sm font-medium"
                                style={{
                                  background: selected ? "#062F24" : "rgba(6,47,36,0.05)",
                                  color: selected ? "#F8F5EE" : "#062F24",
                                  border: `1px solid ${selected ? "#062F24" : "rgba(6,47,36,0.12)"}`,
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
                          style={{ borderColor: "rgba(6,47,36,0.12)" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className={`${secondaryActionButtonClass} order-2 w-full sm:order-1`}
                      style={{ borderColor: "rgba(6,47,36,0.12)", color: "#062F24" }}
                    >
                      {formCopy.back}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!stepTwoValid}
                      className={`${primaryActionButtonClass} order-1 sm:order-2`}
                      style={{ background: "#062F24", border: "1px solid #062F24", color: "#FFFFFF" }}
                    >
                      {formCopy.review}
                      <ArrowRight size={18} />
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
                    <DetailRow label={formCopy.summary.phone} value={formattedPhone} />
                    {form.email ? <DetailRow label={formCopy.summary.email} value={form.email} /> : null}
                    {form.occasion !== "none" && selectedOccasion ? (
                      <DetailRow label={formCopy.summary.occasion} value={selectedOccasion.label} />
                    ) : null}
                    {form.specialRequests ? <DetailRow label={formCopy.summary.requests} value={form.specialRequests} /> : null}
                  </div>

                  <p className="mt-5 max-w-2xl text-base leading-8" style={{ color: "rgba(6,47,36,0.58)" }}>
                    {formCopy.reviewNote}
                  </p>
                  {form.partySize >= 6 ? (
                    <div className="mt-5">
                      <InfoNotice>{formCopy.serviceFeeNotice}</InfoNotice>
                    </div>
                  ) : null}

                  <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className={`${secondaryActionButtonClass} order-2 w-full sm:order-1`}
                      style={{ borderColor: "rgba(6,47,36,0.12)", color: "#062F24" }}
                    >
                      {formCopy.edit}
                    </button>
                    <button
                      type="button"
                      onClick={submitReservation}
                      disabled={loading}
                      className={`${primaryActionButtonClass} order-1 sm:order-2`}
                      style={{ background: "#062F24", border: "1px solid #062F24", color: "#FFFFFF" }}
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {formCopy.confirmReservation}
                      {!loading ? <ArrowRight size={18} /> : null}
                    </button>
                  </div>
                  {submitError ? (
                    <p className="mt-5 rounded-surface border px-4 py-4 text-sm leading-7" style={{ borderColor: "rgba(153,27,27,0.18)", color: "#FCA5A5", background: "rgba(153,27,27,0.14)" }}>
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
                    style={{ background: "rgba(6,47,36,0.08)" }}
                  >
                    <CheckCircle2 size={38} style={{ color: "#062F24" }} />
                  </div>

                  <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: "#062F24" }}>
                    {formCopy.successTitle}
                  </h2>
                  <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 sm:text-base" style={{ color: "rgba(6,47,36,0.66)" }}>
                    {formCopy.successDescription.replace("{phone}", formattedPhone)}
                  </p>

                  <div className={`${panelClass} mt-10 w-full max-w-2xl`}>
                    <p className="text-[11px] font-semibold uppercase" style={{ color: "rgba(6,47,36,0.45)" }}>
                      {formCopy.trackingCode}
                    </p>
                    <p className="mt-2 text-3xl font-bold" style={{ color: "#062F24" }}>
                      {reservationSuccess?.confirmationCode}
                    </p>

                    <div className="mt-6 text-left">
                      <DetailRow label={formCopy.summary.date} value={formatReservationDate(form.date, formCopy.months, language)} />
                      <DetailRow label={formCopy.summary.time} value={form.time} />
                      <DetailRow label={formCopy.summary.guests} value={`${form.partySize} ${guestLabel}`} />
                      <DetailRow label={formCopy.summary.name} value={form.name} />
                    </div>
                    {form.partySize >= 6 ? (
                      <div className="mt-6 text-left">
                        <InfoNotice>{formCopy.serviceFeeNotice}</InfoNotice>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Link
                      href={reservationSuccess?.manageUrlPath ?? "#"}
                      className="order-1 inline-flex w-full items-center justify-center rounded-button px-6 py-4 text-base font-semibold sm:order-1"
                      style={{ background: "#062F24", border: "1px solid #062F24", color: "#FFFFFF" }}
                    >
                      {formCopy.manageReservation}
                    </Link>
                    <Link
                      href="/"
                      className="order-2 inline-flex w-full items-center justify-center rounded-button border px-6 py-4 text-base font-semibold sm:order-2"
                      style={{ borderColor: "rgba(6,47,36,0.12)", color: "#062F24" }}
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
