"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Loader2,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import ModalShell from "@/components/a11y/modal-shell";

type AdminReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

type AdminReservation = {
  id: string;
  confirmationCode: string;
  manageUrlPath: string;
  status: AdminReservationStatus;
  date: string;
  time: string;
  partySize: number;
  guest: {
    name: string;
    phone: string;
    email: string | null;
    language: "EN" | "FR";
  };
  specialRequests: string | null;
  internalNotes: string | null;
};

type DisplayMode = "calendar" | "list";
type CalendarView = "month" | "week" | "day";

type ReservationEditorForm = {
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone: string;
  email: string;
  specialRequests: string;
  internalNotes: string;
};

const fieldClass =
  "w-full rounded border bg-[#F8F5EE] px-3 py-2.5 text-sm text-[#062F24] focus:outline-none";
const buttonClass =
  "rounded px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonStyle = { background: "#C9A56A", color: "#062F24" };
const quietButtonStyle = { background: "rgba(244,232,210,0.14)", color: "#F4E8D2" };
const panelQuietButtonStyle = { background: "rgba(6,47,36,0.08)", color: "#062F24" };

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const slotTimes = ["16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"];

const statusMeta: Record<
  AdminReservationStatus,
  { label: string; description: string; color: string; background: string }
> = {
  PENDING: {
    label: "Pending",
    description: "Awaiting confirmation.",
    color: "#7C5A16",
    background: "#FFF7D6",
  },
  CONFIRMED: {
    label: "Confirmed",
    description: "Active reservation.",
    color: "#065F46",
    background: "#DDF7E8",
  },
  CANCELLED: {
    label: "Cancelled",
    description: "Removed from capacity.",
    color: "#8B1E1E",
    background: "#FFE1D8",
  },
  COMPLETED: {
    label: "Completed",
    description: "Guest was seated.",
    color: "#17456B",
    background: "#DDEEFF",
  },
  NO_SHOW: {
    label: "No-show",
    description: "Guest did not arrive.",
    color: "#5F3B10",
    background: "#FFE8B8",
  },
};

const statusActions = [
  {
    action: "complete",
    label: "Mark completed",
    activeLabel: "Completed",
    status: "COMPLETED",
    background: "#DDEEFF",
    color: "#17456B",
  },
  {
    action: "no_show",
    label: "Mark no-show",
    activeLabel: "No-show",
    status: "NO_SHOW",
    background: "#FFE8B8",
    color: "#5F3B10",
  },
  {
    action: "cancel",
    label: "Cancel reservation",
    activeLabel: "Cancelled",
    status: "CANCELLED",
    background: "#FFE1D8",
    color: "#8B1E1E",
  },
] as const;

function isTerminalStatus(status: AdminReservationStatus) {
  return status === "CANCELLED" || status === "COMPLETED" || status === "NO_SHOW";
}

function formatApiError(
  result: { error?: { code?: string; message?: string; details?: unknown } },
  fallback: string,
) {
  const message = result.error?.message ?? fallback;
  const details = result.error?.details;

  if (!Array.isArray(details)) {
    return result.error?.code ? `${message} (${result.error.code})` : message;
  }

  const detailMessages = details
    .map((detail) => {
      if (
        typeof detail === "object" &&
        detail !== null &&
        "message" in detail &&
        typeof detail.message === "string"
      ) {
        const path =
          "path" in detail && Array.isArray(detail.path)
            ? detail.path.join(".")
            : "";
        return path ? `${path}: ${detail.message}` : detail.message;
      }

      return null;
    })
    .filter(Boolean);

  return [message, ...detailMessages].join(" ");
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function today() {
  return toDateInputValue(new Date());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getCalendarRange(view: CalendarView, anchorDate: Date) {
  if (view === "day") {
    return { start: anchorDate, end: anchorDate };
  }

  if (view === "week") {
    return { start: startOfWeek(anchorDate), end: endOfWeek(anchorDate) };
  }

  return {
    start: startOfWeek(startOfMonth(anchorDate)),
    end: endOfWeek(endOfMonth(anchorDate)),
  };
}

function getCalendarTitle(view: CalendarView, anchorDate: Date) {
  if (view === "day") {
    return new Intl.DateTimeFormat("en-CA", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(anchorDate);
  }

  if (view === "week") {
    const range = getCalendarRange("week", anchorDate);
    const start = new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
    }).format(range.start);
    const end = new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(range.end);

    return `${start} - ${end}`;
  }

  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
  }).format(anchorDate);
}

function getCurrentPeriodLabel(view: CalendarView) {
  if (view === "month") return "This month";
  if (view === "week") return "This week";
  return "Today";
}

function moveAnchorDate(view: CalendarView, anchorDate: Date, direction: -1 | 1) {
  if (view === "day") return addDays(anchorDate, direction);
  if (view === "week") return addDays(anchorDate, direction * 7);
  return new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1);
}

function sameMonth(date: Date, anchorDate: Date) {
  return (
    date.getFullYear() === anchorDate.getFullYear() &&
    date.getMonth() === anchorDate.getMonth()
  );
}

function getDatesBetween(start: Date, end: Date) {
  const dates: Date[] = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function formatDisplayTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function reservationsOnDate(reservations: AdminReservation[], date: string) {
  return reservations
    .filter((reservation) => reservation.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
}

function reservationsAtSlot(
  reservations: AdminReservation[],
  date: string,
  time: string,
) {
  return reservations
    .filter((reservation) => reservation.date === date && reservation.time === time)
    .sort((a, b) => a.guest.name.localeCompare(b.guest.name));
}

function isDisplayMode(value: string | null): value is DisplayMode {
  return value === "calendar" || value === "list";
}

function isCalendarView(value: string | null): value is CalendarView {
  return value === "month" || value === "week" || value === "day";
}

function isAdminReservationStatus(
  value: string | null,
): value is AdminReservationStatus {
  return (
    value === "PENDING" ||
    value === "CONFIRMED" ||
    value === "CANCELLED" ||
    value === "COMPLETED" ||
    value === "NO_SHOW"
  );
}

function isValidDateInput(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default function AdminReservationsDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSearchParams = useRef(searchParams);
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const value = initialSearchParams.current.get("mode");
    return isDisplayMode(value) ? value : "calendar";
  });
  const [calendarView, setCalendarView] = useState<CalendarView>(() => {
    const value = initialSearchParams.current.get("view");
    return isCalendarView(value) ? value : "week";
  });
  const [anchorDate, setAnchorDate] = useState(() => {
    const value = initialSearchParams.current.get("date");
    return parseDateInput(isValidDateInput(value) ? value : today());
  });
  const [date, setDate] = useState(() => {
    const value = initialSearchParams.current.get("listDate");
    return isValidDateInput(value) ? value : "";
  });
  const [status, setStatus] = useState<AdminReservationStatus | "ALL">(() => {
    const value = initialSearchParams.current.get("status");
    return isAdminReservationStatus(value) ? value : "ALL";
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedReservationId, setCopiedReservationId] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<AdminReservation | null>(null);
  const [editorForm, setEditorForm] = useState<ReservationEditorForm | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState({
    date: today(),
    time: "16:30",
    partySize: 5,
    name: "",
    phone: "",
    email: "",
    language: "FR",
    specialRequests: "",
    internalNotes: "",
  });

  const loadReservations = async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();

    if (displayMode === "calendar") {
      const range = getCalendarRange(calendarView, anchorDate);
      params.set("dateFrom", toDateInputValue(range.start));
      params.set("dateTo", toDateInputValue(range.end));
    } else if (date) {
      params.set("date", date);
    }

    if (status !== "ALL") params.set("status", status);

    const response = await fetch(`/api/admin/reservations?${params.toString()}`);
    const result = await response.json();

    if (!result.ok) {
      setError(formatApiError(result, "Unable to load reservations."));
      setReservations([]);
    } else {
      setReservations(result.data.reservations);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode, calendarView, anchorDate, date, status]);

  useEffect(() => {
    const params = new URLSearchParams();

    params.set("mode", displayMode);
    params.set("status", status);

    if (displayMode === "calendar") {
      params.set("view", calendarView);
      params.set("date", toDateInputValue(anchorDate));
    } else if (date) {
      params.set("listDate", date);
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [anchorDate, calendarView, date, displayMode, pathname, router, status]);

  const createReservation = async () => {
    setSaving(true);
    setError("");

    const response = await fetch("/api/admin/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json();

    if (!result.ok) {
      setError(formatApiError(result, "Unable to create reservation."));
    } else {
      setForm((current) => ({
        ...current,
        name: "",
        phone: "",
        email: "",
        specialRequests: "",
        internalNotes: "",
      }));
      setCreateDialogOpen(false);
      await loadReservations();
    }

    setSaving(false);
  };

  const updateReservation = async (id: string, body: Record<string, unknown>) => {
    setSaving(true);
    setError("");

    const response = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (!result.ok) {
      setError(formatApiError(result, "Unable to update reservation."));
    }

    await loadReservations();
    setSaving(false);
  };

  const applyStatusAction = async (
    reservation: AdminReservation,
    action: (typeof statusActions)[number]["action"],
  ) => {
    if (action === "cancel") {
      const confirmed = window.confirm(
        "Cancel this reservation? It will be removed from online capacity.",
      );

      if (!confirmed) return;
    }

    await updateReservation(reservation.id, { action });
    setSelectedReservation(null);
    setEditorForm(null);
  };

  const openReservationDialog = (reservation: AdminReservation) => {
    setSelectedReservation(reservation);
    setEditorForm({
      date: reservation.date,
      time: reservation.time,
      partySize: reservation.partySize,
      name: reservation.guest.name,
      phone: reservation.guest.phone,
      email: reservation.guest.email ?? "",
      specialRequests: reservation.specialRequests ?? "",
      internalNotes: reservation.internalNotes ?? "",
    });
  };

  const closeReservationDialog = () => {
    setSelectedReservation(null);
    setEditorForm(null);
  };

  const saveReservationDialog = async () => {
    if (!selectedReservation || !editorForm) return;

    await updateReservation(selectedReservation.id, {
      date: editorForm.date,
      time: editorForm.time,
      partySize: editorForm.partySize,
      name: editorForm.name,
      phone: editorForm.phone,
      email: editorForm.email,
      specialRequests: editorForm.specialRequests,
      internalNotes: editorForm.internalNotes,
    });
    closeReservationDialog();
  };

  const copyText = async (reservation: AdminReservation, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedReservationId(reservation.id);
      window.setTimeout(() => setCopiedReservationId(null), 1800);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  };

  const getManageUrl = (reservation: AdminReservation) => {
    if (typeof window === "undefined") {
      return reservation.manageUrlPath;
    }

    return new URL(reservation.manageUrlPath, window.location.origin).toString();
  };

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const renderStatusPill = (reservation: AdminReservation) => (
    <span
      className="inline-flex rounded px-3 py-1 text-xs font-bold"
      style={{
        background: statusMeta[reservation.status].background,
        color: statusMeta[reservation.status].color,
      }}
    >
      {statusMeta[reservation.status].label}
    </span>
  );

  const renderActionMenu = (reservation: AdminReservation, compact = false) => (
    <details className="relative" onClick={(event) => event.stopPropagation()}>
      <summary
        className="inline-flex cursor-pointer list-none rounded px-3 py-1.5 text-[11px] font-black"
        style={{
          background: compact ? "rgba(248,245,238,0.82)" : "rgba(6,47,36,0.08)",
          color: "#062F24",
        }}
      >
        Actions
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded border border-[#062F24]/10 bg-[#F8F5EE] p-2 text-left shadow-xl">
        <button
          type="button"
          className="rounded px-3 py-2 text-left text-xs font-bold text-[#062F24] hover:bg-[#062F24]/5"
          onClick={() => openReservationDialog(reservation)}
        >
          Edit reservation
        </button>
        <button
          type="button"
          className="rounded px-3 py-2 text-left text-xs font-bold text-[#062F24] hover:bg-[#062F24]/5"
          onClick={() => copyText(reservation, getManageUrl(reservation))}
        >
          Copy manage link
        </button>
        <button
          type="button"
          className="rounded px-3 py-2 text-left text-xs font-bold text-[#062F24] hover:bg-[#062F24]/5"
          onClick={() => copyText(reservation, reservation.confirmationCode)}
        >
          Copy confirmation code
        </button>
        <button
          type="button"
          className="rounded px-3 py-2 text-left text-xs font-bold text-[#062F24] hover:bg-[#062F24]/5"
          onClick={() => copyText(reservation, reservation.guest.phone)}
        >
          Copy guest phone
        </button>
        <Link
          className="rounded px-3 py-2 text-left text-xs font-bold text-[#062F24] hover:bg-[#062F24]/5"
          href={reservation.manageUrlPath}
          target="_blank"
          rel="noreferrer"
        >
          Open manage page
        </Link>
        {reservation.guest.email ? (
          <a
            className="rounded px-3 py-2 text-left text-xs font-bold text-[#062F24] hover:bg-[#062F24]/5"
            href={`mailto:${reservation.guest.email}`}
          >
            Email guest
          </a>
        ) : null}
        <a
          className="rounded px-3 py-2 text-left text-xs font-bold text-[#062F24] hover:bg-[#062F24]/5"
          href={`tel:${reservation.guest.phone}`}
        >
          Call guest
        </a>
        {copiedReservationId === reservation.id ? (
          <p className="px-3 py-1 text-[11px] font-black text-[#C9A56A]">
            Copied
          </p>
        ) : null}
      </div>
    </details>
  );

  const renderCalendarEvent = (reservation: AdminReservation, compact = false) => (
    <div
      key={reservation.id}
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded border px-2.5 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      onClick={() => openReservationDialog(reservation)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openReservationDialog(reservation);
        }
      }}
      style={{
        borderColor: statusMeta[reservation.status].color,
        background: statusMeta[reservation.status].background,
        color: statusMeta[reservation.status].color,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-xs font-black">
          {formatDisplayTime(reservation.time)} {reservation.guest.name}
        </p>
        <p className="shrink-0 text-[10px] font-black">{reservation.partySize}p</p>
      </div>
      {!compact ? (
        <>
          <p className="mt-1 truncate text-[11px] font-semibold">
            {reservation.guest.phone}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold">
              {statusMeta[reservation.status].label}
            </p>
            {renderActionMenu(reservation, true)}
          </div>
        </>
      ) : null}
    </div>
  );

  const renderReservationListItem = (reservation: AdminReservation) => (
    <div
      key={reservation.id}
      className="border-b border-l-4 border-b-[#062F24]/10 p-5 last:border-b-0"
      style={{ borderLeftColor: statusMeta[reservation.status].color }}
    >
      <div className="grid gap-3 lg:grid-cols-[0.7fr_1fr_1.3fr]">
        <div>
          <p className="font-bold text-[#062F24]">
            {reservation.date} {reservation.time}
          </p>
          <p className="text-sm text-[#062F24]/65">{reservation.partySize} guests</p>
          <div className="mt-3">{renderStatusPill(reservation)}</div>
          <p className="mt-2 text-xs font-semibold text-[#062F24]/60">
            {statusMeta[reservation.status].description}
          </p>
          <p className="mt-3 text-xs font-semibold text-[#062F24]/55">
            Code: {reservation.confirmationCode}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              onClick={() => openReservationDialog(reservation)}
              style={primaryButtonStyle}
            >
              Open details
            </button>
            {renderActionMenu(reservation)}
          </div>
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          <input
            className={fieldClass}
            aria-label={`Guest name for ${reservation.confirmationCode}`}
            name={`guest-name-${reservation.id}`}
            autoComplete="name"
            defaultValue={reservation.guest.name}
            onBlur={(event) =>
              updateReservation(reservation.id, { name: event.target.value })
            }
          />
          <input
            className={`${fieldClass} mt-2`}
            aria-label={`Guest phone for ${reservation.confirmationCode}`}
            name={`guest-phone-${reservation.id}`}
            autoComplete="tel"
            inputMode="tel"
            defaultValue={reservation.guest.phone}
            onBlur={(event) =>
              updateReservation(reservation.id, { phone: event.target.value })
            }
          />
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          <textarea
            className={fieldClass}
            aria-label={`Internal notes for ${reservation.confirmationCode}`}
            name={`internal-notes-${reservation.id}`}
            defaultValue={reservation.internalNotes ?? ""}
            placeholder="Internal notes…"
            onBlur={(event) =>
              updateReservation(reservation.id, { internalNotes: event.target.value })
            }
          />
          <div className="mt-3 rounded border border-[#062F24]/10 bg-[#F4E8D2]/55 p-3">
            <p className="text-xs font-bold text-[#062F24]/55">
              Status actions
            </p>
            {isTerminalStatus(reservation.status) ? (
              <p className="mt-2 text-sm font-semibold text-[#062F24]">
                Final state: {statusMeta[reservation.status].label}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {statusActions.map((statusAction) => {
                const isCurrentStatus = reservation.status === statusAction.status;
                const disabled = saving || isTerminalStatus(reservation.status);

                return (
                  <button
                    key={statusAction.action}
                    className={buttonClass}
                    onClick={() => applyStatusAction(reservation, statusAction.action)}
                    disabled={disabled}
                    style={{
                      background: isCurrentStatus
                        ? statusMeta[reservation.status].background
                        : statusAction.background,
                      color: isCurrentStatus
                        ? statusMeta[reservation.status].color
                        : statusAction.color,
                    }}
                  >
                    {isCurrentStatus ? statusAction.activeLabel : statusAction.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCalendar = () => {
    const range = getCalendarRange(calendarView, anchorDate);
    const days = getDatesBetween(range.start, range.end);

    if (calendarView === "month") {
      return (
        <div className="overflow-hidden rounded border border-[#062F24]/10 bg-[#F8F5EE]">
          <div className="grid grid-cols-7 border-b border-[#062F24]/10 bg-[#F4E8D2]">
            {weekDays.map((day) => (
              <div key={day} className="p-3 text-xs font-black text-[#062F24]/60">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-7">
            {days.map((day) => {
              const key = toDateInputValue(day);
              const dayReservations = reservationsOnDate(reservations, key);
              const inactive = !sameMonth(day, anchorDate);

              return (
                <div
                  key={key}
                  className="min-h-[138px] border-b border-r border-[#062F24]/10 p-2 last:border-r-0"
                  style={{ background: inactive ? "rgba(6,47,36,0.04)" : "#F8F5EE" }}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-sm font-black text-[#062F24]"
                      onClick={() => {
                        setAnchorDate(day);
                        setCalendarView("day");
                      }}
                    >
                      {day.getDate()}
                    </button>
                    {dayReservations.length ? (
                      <span className="rounded bg-[#C9A56A]/25 px-2 py-1 text-[10px] font-black text-[#062F24]">
                        {dayReservations.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 grid gap-1.5">
                    {dayReservations.slice(0, 4).map((reservation) =>
                      renderCalendarEvent(reservation, true),
                    )}
                    {dayReservations.length > 4 ? (
                      <button
                        type="button"
                        className="text-left text-[11px] font-bold text-[#062F24]/65"
                        onClick={() => {
                          setAnchorDate(day);
                          setCalendarView("day");
                        }}
                      >
                        +{dayReservations.length - 4} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (calendarView === "week") {
      return (
        <div className="overflow-x-auto rounded border border-[#062F24]/10 bg-[#F8F5EE]">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[88px_repeat(7,minmax(112px,1fr))] border-b border-[#062F24]/10 bg-[#F4E8D2]">
              <div className="p-3 text-xs font-black text-[#062F24]/45">
                Time
              </div>
              {days.map((day) => (
                <button
                  key={toDateInputValue(day)}
                  type="button"
                  className="p-3 text-left"
                  onClick={() => {
                    setAnchorDate(day);
                    setCalendarView("day");
                  }}
                >
                  <p className="text-xs font-black text-[#062F24]/50">
                    {weekDays[day.getDay()]}
                  </p>
                  <p className="mt-1 text-xl font-black text-[#062F24]">{day.getDate()}</p>
                </button>
              ))}
            </div>
            {slotTimes.map((time) => (
              <div
                key={time}
                className="grid grid-cols-[88px_repeat(7,minmax(112px,1fr))] border-b border-[#062F24]/10 last:border-b-0"
              >
                <div className="bg-[#F4E8D2]/55 p-3 text-xs font-black text-[#062F24]/55">
                  {formatDisplayTime(time)}
                </div>
                {days.map((day) => {
                  const key = toDateInputValue(day);
                  const slotReservations = reservationsAtSlot(reservations, key, time);

                  return (
                    <div key={`${key}-${time}`} className="min-h-[96px] border-l border-[#062F24]/10 p-2">
                      <div className="grid gap-2">
                        {slotReservations.map((reservation) =>
                          renderCalendarEvent(reservation),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      );
    }

    const selectedDate = toDateInputValue(anchorDate);

    return (
      <div className="rounded border border-[#062F24]/10 bg-[#F8F5EE]">
        {slotTimes.map((time) => {
          const slotReservations = reservationsAtSlot(reservations, selectedDate, time);

          return (
            <div
              key={time}
              className="grid gap-4 border-b border-[#062F24]/10 p-4 last:border-b-0 sm:grid-cols-[120px_1fr]"
            >
              <div>
                <p className="text-sm font-black text-[#062F24]">
                  {formatDisplayTime(time)}
                </p>
                <p className="text-xs font-semibold text-[#062F24]/50">
                  {slotReservations.reduce((total, reservation) => total + reservation.partySize, 0)} guests
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {slotReservations.length ? (
                  slotReservations.map((reservation) => renderCalendarEvent(reservation))
                ) : (
                  <p className="rounded border border-dashed border-[#062F24]/15 p-4 text-sm font-semibold text-[#062F24]/45">
                    No reservations.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderReservationDialog = () => {
    if (!selectedReservation || !editorForm) return null;

    return (
      <ModalShell
        labelledBy="reservation-dialog-title"
        onClose={closeReservationDialog}
        panelClassName="max-w-3xl"
      >
          <div className="flex flex-col justify-between gap-4 border-b border-[#062F24]/10 pb-5 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-black text-[#C9A56A]">
                Reservation details
              </p>
              <h2 id="reservation-dialog-title" className="mt-2 text-3xl font-black text-[#062F24]">
                {selectedReservation.guest.name}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {renderStatusPill(selectedReservation)}
                <span className="rounded bg-[#C9A56A]/25 px-3 py-1 text-xs font-black text-[#062F24]">
                  {selectedReservation.confirmationCode}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {renderActionMenu(selectedReservation)}
              <button
                type="button"
                className={buttonClass}
                onClick={closeReservationDialog}
                style={panelQuietButtonStyle}
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="text-xs font-black text-[#062F24]/55">
              Date
              <input
                className={`${fieldClass} mt-2`}
                type="date"
                name="reservation-date"
                value={editorForm.date}
                onChange={(event) =>
                  setEditorForm({ ...editorForm, date: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-black text-[#062F24]/55">
              Time
              <select
                className={`${fieldClass} mt-2`}
                name="reservation-time"
                value={editorForm.time}
                onChange={(event) =>
                  setEditorForm({ ...editorForm, time: event.target.value })
                }
              >
                {slotTimes.map((time) => (
                  <option key={time} value={time}>
                    {formatDisplayTime(time)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black text-[#062F24]/55">
              Party size
              <input
                className={`${fieldClass} mt-2`}
                type="number"
                name="party-size"
                inputMode="numeric"
                min={1}
                value={editorForm.partySize}
                onChange={(event) =>
                  setEditorForm({
                    ...editorForm,
                    partySize: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-black text-[#062F24]/55">
              Guest name
              <input
                className={`${fieldClass} mt-2`}
                name="guest-name"
                autoComplete="name"
                value={editorForm.name}
                onChange={(event) =>
                  setEditorForm({ ...editorForm, name: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-black text-[#062F24]/55">
              Phone
              <input
                className={`${fieldClass} mt-2`}
                name="guest-phone"
                autoComplete="tel"
                inputMode="tel"
                value={editorForm.phone}
                onChange={(event) =>
                  setEditorForm({ ...editorForm, phone: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-black text-[#062F24]/55 md:col-span-2">
              Email
              <input
                className={`${fieldClass} mt-2`}
                type="email"
                name="guest-email"
                autoComplete="email"
                spellCheck={false}
                value={editorForm.email}
                onChange={(event) =>
                  setEditorForm({ ...editorForm, email: event.target.value })
                }
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-black text-[#062F24]/55">
              Special requests
              <textarea
                className={`${fieldClass} mt-2 min-h-[120px]`}
                name="special-requests"
                value={editorForm.specialRequests}
                onChange={(event) =>
                  setEditorForm({
                    ...editorForm,
                    specialRequests: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs font-black text-[#062F24]/55">
              Internal notes
              <textarea
                className={`${fieldClass} mt-2 min-h-[120px]`}
                name="internal-notes"
                value={editorForm.internalNotes}
                onChange={(event) =>
                  setEditorForm({ ...editorForm, internalNotes: event.target.value })
                }
              />
            </label>
          </div>

          <div className="mt-6 rounded border border-[#062F24]/10 bg-[#F4E8D2]/55 p-4">
            <p className="text-xs font-black text-[#062F24]/55">
              Status actions
            </p>
            {isTerminalStatus(selectedReservation.status) ? (
              <p className="mt-2 text-sm font-semibold text-[#062F24]">
                Final state: {statusMeta[selectedReservation.status].label}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {statusActions.map((statusAction) => {
                const isCurrentStatus =
                  selectedReservation.status === statusAction.status;
                const disabled = saving || isTerminalStatus(selectedReservation.status);

                return (
                  <button
                    key={statusAction.action}
                    className={buttonClass}
                    onClick={() =>
                      applyStatusAction(selectedReservation, statusAction.action)
                    }
                    disabled={disabled}
                    style={{
                      background: isCurrentStatus
                        ? statusMeta[selectedReservation.status].background
                        : statusAction.background,
                      color: isCurrentStatus
                        ? statusMeta[selectedReservation.status].color
                        : statusAction.color,
                    }}
                  >
                    {isCurrentStatus ? statusAction.activeLabel : statusAction.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={buttonClass}
              onClick={closeReservationDialog}
              style={panelQuietButtonStyle}
            >
              Discard
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={saveReservationDialog}
              disabled={saving}
              style={primaryButtonStyle}
            >
              {saving ? <Loader2 size={14} className="mr-2 inline animate-spin" aria-hidden="true" /> : null}
              {saving ? "Saving… Save changes" : "Save changes"}
            </button>
          </div>
      </ModalShell>
    );
  };

  const renderCreateDialog = () => {
    if (!createDialogOpen) return null;

    return (
      <ModalShell
        labelledBy="create-reservation-dialog-title"
        onClose={() => setCreateDialogOpen(false)}
        panelClassName="max-w-2xl"
      >
          <div className="flex items-start justify-between gap-4 border-b border-[#062F24]/10 pb-5">
            <div>
              <p className="text-xs font-black text-[#C9A56A]">
                Admin
              </p>
              <h2 id="create-reservation-dialog-title" className="mt-2 text-3xl font-black text-[#062F24]">
                Create reservation
              </h2>
            </div>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setCreateDialogOpen(false)}
              style={panelQuietButtonStyle}
            >
              Close
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="text-xs font-black text-[#062F24]/55">
              Date
              <input
                className={`${fieldClass} mt-2`}
                type="date"
                name="new-reservation-date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
            <label className="text-xs font-black text-[#062F24]/55">
              Time
              <select
                className={`${fieldClass} mt-2`}
                name="new-reservation-time"
                value={form.time}
                onChange={(event) => setForm({ ...form, time: event.target.value })}
              >
                {slotTimes.map((time) => (
                  <option key={time} value={time}>
                    {formatDisplayTime(time)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black text-[#062F24]/55">
              Party size
              <input
                className={`${fieldClass} mt-2`}
                type="number"
                name="new-party-size"
                inputMode="numeric"
                min={1}
                value={form.partySize}
                onChange={(event) =>
                  setForm({ ...form, partySize: Number(event.target.value) })
                }
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-black text-[#062F24]/55">
              Guest name
              <input
                className={`${fieldClass} mt-2`}
                name="new-guest-name"
                autoComplete="name"
                placeholder="Guest name…"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="text-xs font-black text-[#062F24]/55">
              Phone
              <input
                className={`${fieldClass} mt-2`}
                name="new-guest-phone"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+1 (123) 456-7890"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <label className="text-xs font-black text-[#062F24]/55 md:col-span-2">
              Email
              <input
                className={`${fieldClass} mt-2`}
                type="email"
                name="new-guest-email"
                autoComplete="email"
                spellCheck={false}
                placeholder="guest@example.com"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-black text-[#062F24]/55">
              Special requests
              <textarea
                className={`${fieldClass} mt-2 min-h-[120px]`}
                name="new-special-requests"
                placeholder="Allergies, accessibility notes, occasion…"
                value={form.specialRequests}
                onChange={(event) =>
                  setForm({ ...form, specialRequests: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-black text-[#062F24]/55">
              Internal notes
              <textarea
                className={`${fieldClass} mt-2 min-h-[120px]`}
                name="new-internal-notes"
                placeholder="Staff notes…"
                value={form.internalNotes}
                onChange={(event) =>
                  setForm({ ...form, internalNotes: event.target.value })
                }
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={buttonClass}
              onClick={() => setCreateDialogOpen(false)}
              style={panelQuietButtonStyle}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={createReservation}
              disabled={saving}
              className={buttonClass}
              style={primaryButtonStyle}
            >
              {saving ? <Loader2 size={14} className="mr-2 inline animate-spin" aria-hidden="true" /> : null}
              {saving ? "Saving… Create reservation" : "Create reservation"}
            </button>
          </div>
      </ModalShell>
    );
  };

  return (
    <section className="px-6 pb-20 pt-32" style={{ background: "#041F18" }}>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[#C9A56A]">
              Admin
            </p>
            <h1 className="mt-3 text-5xl font-bold text-[#F4E8D2]">
              Reservations
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setForm((current) => ({
                  ...current,
                  date: toDateInputValue(anchorDate),
                }));
                setCreateDialogOpen(true);
              }}
              className={buttonClass}
              style={primaryButtonStyle}
            >
              Create reservation
            </button>
            <Link href="/admin/settings" className={buttonClass} style={quietButtonStyle}>
              Settings
            </Link>
            <button type="button" onClick={signOut} className={buttonClass} style={quietButtonStyle}>
              Sign out
            </button>
          </div>
        </div>

        {error ? (
          <p
            className="mt-6 rounded bg-red-900/20 p-4 text-sm text-red-200"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-8">
          <div>
            <div className="mb-4 rounded bg-[#F8F5EE] p-4">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDisplayMode("calendar")}
                    className={buttonClass}
                    style={{
                      background: displayMode === "calendar" ? "#C9A56A" : "rgba(6,47,36,0.08)",
                      color: "#062F24",
                    }}
                  >
                    <CalendarDays size={14} className="mr-2 inline" />
                    Calendar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode("list")}
                    className={buttonClass}
                    style={{
                      background: displayMode === "list" ? "#C9A56A" : "rgba(6,47,36,0.08)",
                      color: "#062F24",
                    }}
                  >
                    <ListChecks size={14} className="mr-2 inline" />
                    List
                  </button>
                </div>

                <select
                  className={`${fieldClass} lg:max-w-[220px]`}
                  value={status}
                  aria-label="Filter reservations by status"
                  onChange={(event) => {
                    const nextStatus = event.target.value;
                    setStatus(
                      isAdminReservationStatus(nextStatus) ? nextStatus : "ALL",
                    );
                  }}
                >
                  <option value="ALL">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="NO_SHOW">No show</option>
                </select>
              </div>

              {displayMode === "calendar" ? (
                <div className="mt-4 rounded border border-[#062F24]/10 bg-[#F4E8D2]/55 p-3">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => setAnchorDate(parseDateInput(today()))}
                        style={primaryButtonStyle}
                      >
                        {getCurrentPeriodLabel(calendarView)}
                      </button>
                      <input
                        className={`${fieldClass} max-w-[170px] bg-[#F8F5EE]`}
                        type="date"
                        aria-label="Go to calendar date"
                        value={toDateInputValue(anchorDate)}
                        onChange={(event) => {
                          if (event.target.value) {
                            setAnchorDate(parseDateInput(event.target.value));
                          }
                        }}
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 items-center justify-start gap-3 xl:justify-center">
                      <button
                        type="button"
                        aria-label={`Previous ${calendarView}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#062F24]/10 bg-[#F8F5EE] text-[#062F24] transition hover:bg-[#C9A56A]"
                        onClick={() =>
                          setAnchorDate(
                            moveAnchorDate(calendarView, anchorDate, -1),
                          )
                        }
                      >
                        <ChevronLeft size={18} />
                      </button>

                      <div className="min-w-0 text-left xl:text-center">
                        <p className="text-[11px] font-black text-[#062F24]/45">
                          {calendarView} view
                        </p>
                        <p className="truncate text-2xl font-black leading-tight text-[#062F24] sm:text-3xl">
                          {getCalendarTitle(calendarView, anchorDate)}
                        </p>
                      </div>

                      <button
                        type="button"
                        aria-label={`Next ${calendarView}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#062F24]/10 bg-[#F8F5EE] text-[#062F24] transition hover:bg-[#C9A56A]"
                        onClick={() =>
                          setAnchorDate(
                            moveAnchorDate(calendarView, anchorDate, 1),
                          )
                        }
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    <div className="inline-flex w-full rounded bg-[#062F24]/10 p-1 sm:w-auto">
                      {(["month", "week", "day"] as const).map((view) => (
                        <button
                          key={view}
                          type="button"
                          className="flex-1 rounded px-4 py-2 text-xs font-black transition sm:flex-none"
                          onClick={() => setCalendarView(view)}
                          style={{
                            background: calendarView === view ? "#C9A56A" : "transparent",
                            color: "#062F24",
                          }}
                        >
                          {view}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    className={fieldClass}
                    type="date"
                    aria-label="Filter list by date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                  <button type="button" onClick={() => setDate("")} className={buttonClass} style={panelQuietButtonStyle}>
                    Upcoming
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-3 rounded bg-[#F8F5EE] p-6 text-[#062F24]">
                <Loader2 size={16} className="animate-spin" />
                Loading reservations…
              </div>
            ) : null}

            {!loading && displayMode === "calendar" ? renderCalendar() : null}

            {!loading && displayMode === "list" ? (
              <div className="overflow-hidden rounded bg-[#F8F5EE]">
                {reservations.length === 0 ? (
                  <p className="p-6 text-sm text-[#062F24]/70">No reservations found.</p>
                ) : null}
                {reservations.map((reservation) => renderReservationListItem(reservation))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {renderReservationDialog()}
      {renderCreateDialog()}
    </section>
  );
}
