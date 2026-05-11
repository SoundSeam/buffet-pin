"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  ListChecks,
  Loader2,
  RotateCw,
  X,
} from "lucide-react";

import { useTranslation } from "@/components/providers/language-provider";
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
  reservationAt: string;
  partySize: number;
  guest: {
    name: string;
    phone: string;
    email: string | null;
    language: "EN" | "FR";
  };
  specialRequests: string | null;
  internalNotes: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
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

type ReservationActivityKind = "new" | "updated" | "cancelled";

type ReservationActivity = {
  kind: ReservationActivityKind;
  reservation: AdminReservation;
};

type LoadReservationsOptions = {
  foreground?: boolean;
  source?: "initial" | "filter" | "manual" | "poll" | "mutation";
};

const fieldClass =
  "w-full rounded border border-[rgba(6,47,36,0.12)] bg-[rgba(6,47,36,0.05)] px-3 py-2.5 text-sm text-[#062F24] focus:outline-none focus-visible:outline-none focus-visible:outline-0";
const buttonClass =
  "inline-flex items-center justify-center rounded px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50";
const actionMenuItemClass =
  "rounded px-3 py-2.5 text-left text-sm font-semibold text-[#062F24] hover:bg-[#062F24]/5";
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
const dangerButtonStyle = {
  background: "#FFFFFF",
  border: "1px solid rgba(153,27,27,0.18)",
  color: "#7F1D1D",
};
const POLL_INTERVAL_MS = 15000;

const slotTimes = Array.from({ length: 11 }, (_, index) => {
  const totalMinutes = 16 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

const statusSurfaceMeta: Record<
  AdminReservationStatus,
  { color: string; background: string }
> = {
  PENDING: {
    color: "#7C5A16",
    background: "#FFF7D6",
  },
  CONFIRMED: {
    color: "#065F46",
    background: "#DDF7E8",
  },
  CANCELLED: {
    color: "#8B1E1E",
    background: "#FFE1D8",
  },
  COMPLETED: {
    color: "#17456B",
    background: "#DDEEFF",
  },
  NO_SHOW: {
    color: "#5F3B10",
    background: "#FFE8B8",
  },
};

const statusActionMeta = [
  {
    action: "complete",
    status: "COMPLETED",
    background: "#DDEEFF",
    color: "#17456B",
  },
  {
    action: "no_show",
    status: "NO_SHOW",
    background: "#FFE8B8",
    color: "#5F3B10",
  },
  {
    action: "cancel",
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

function getLocale(language: "fr" | "en") {
  return language === "fr" ? "fr-CA" : "en-CA";
}

function formatHumanDate(value: string, language: "fr" | "en") {
  return parseDateInput(value).toLocaleDateString(getLocale(language), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

function getCalendarTitle(view: CalendarView, anchorDate: Date, language: "fr" | "en") {
  if (view === "day") {
    return new Intl.DateTimeFormat(getLocale(language), {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(anchorDate);
  }

  if (view === "week") {
    const range = getCalendarRange("week", anchorDate);
    const start = new Intl.DateTimeFormat(getLocale(language), {
      month: "short",
      day: "numeric",
    }).format(range.start);
    const end = new Intl.DateTimeFormat(getLocale(language), {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(range.end);

    return `${start} - ${end}`;
  }

  return new Intl.DateTimeFormat(getLocale(language), {
    month: "long",
    year: "numeric",
  }).format(anchorDate);
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

function formatDisplayTime(time: string, language: "fr" | "en") {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2026, 0, 1, hour, minute);

  return new Intl.DateTimeFormat(getLocale(language), {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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

function compareReservationsAscending(a: AdminReservation, b: AdminReservation) {
  return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
}

function compareReservationsDescending(a: AdminReservation, b: AdminReservation) {
  return compareReservationsAscending(b, a);
}

function compareActivitiesDescending(a: ReservationActivity, b: ReservationActivity) {
  return b.reservation.updatedAt.localeCompare(a.reservation.updatedAt);
}

function detectReservationActivity(
  previousReservations: AdminReservation[],
  nextReservations: AdminReservation[],
) {
  const previousById = new Map(
    previousReservations.map((reservation) => [reservation.id, reservation]),
  );
  const activity: ReservationActivity[] = [];

  for (const reservation of nextReservations) {
    const previousReservation = previousById.get(reservation.id);

    if (!previousReservation) {
      activity.push({ kind: "new", reservation });
      continue;
    }

    if (previousReservation.updatedAt === reservation.updatedAt) {
      continue;
    }

    if (
      reservation.status === "CANCELLED" &&
      previousReservation.status !== "CANCELLED"
    ) {
      activity.push({ kind: "cancelled", reservation });
      continue;
    }

    activity.push({ kind: "updated", reservation });
  }

  return activity.sort(compareActivitiesDescending);
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
  const { language, copy } = useTranslation();
  const reservationsCopy = copy.admin.reservations;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSearchParams = useRef(searchParams);
  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const latestReservationsRef = useRef<AdminReservation[] | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const suppressChangeAlertsRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [copiedReservationId, setCopiedReservationId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<AdminReservation | null>(null);
  const [editorForm, setEditorForm] = useState<ReservationEditorForm | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityItems, setActivityItems] = useState<ReservationActivity[]>([]);
  const [form, setForm] = useState({
    date: today(),
    time: "16:30",
    partySize: 6,
    name: "",
    phone: "",
    email: "",
    language: language.toUpperCase(),
    specialRequests: "",
    internalNotes: "",
  });

  const statusMeta: Record<
    AdminReservationStatus,
    { label: string; description: string; color: string; background: string }
  > = {
    PENDING: {
      label: reservationsCopy.statusLabels.PENDING,
      description: reservationsCopy.statusDescriptions.PENDING,
      ...statusSurfaceMeta.PENDING,
    },
    CONFIRMED: {
      label: reservationsCopy.statusLabels.CONFIRMED,
      description: reservationsCopy.statusDescriptions.CONFIRMED,
      ...statusSurfaceMeta.CONFIRMED,
    },
    CANCELLED: {
      label: reservationsCopy.statusLabels.CANCELLED,
      description: reservationsCopy.statusDescriptions.CANCELLED,
      ...statusSurfaceMeta.CANCELLED,
    },
    COMPLETED: {
      label: reservationsCopy.statusLabels.COMPLETED,
      description: reservationsCopy.statusDescriptions.COMPLETED,
      ...statusSurfaceMeta.COMPLETED,
    },
    NO_SHOW: {
      label: reservationsCopy.statusLabels.NO_SHOW,
      description: reservationsCopy.statusDescriptions.NO_SHOW,
      ...statusSurfaceMeta.NO_SHOW,
    },
  };

  useEffect(() => {
    setForm((current) => ({ ...current, language: language.toUpperCase() }));
  }, [language]);

  useEffect(() => {
    if (!openActionMenuId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const activeMenu = actionMenuRefs.current[openActionMenuId];
      if (!activeMenu) return;

      if (!activeMenu.contains(event.target as Node)) {
        setOpenActionMenuId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenActionMenuId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openActionMenuId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const unlockAudio = async () => {
      const AudioContextConstructor =
        window.AudioContext ??
        (
          window as Window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextConstructor) {
        return;
      }

      audioUnlockedRef.current = true;

      try {
        audioContextRef.current ??= new AudioContextConstructor();

        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }
      } catch {
        audioContextRef.current = null;
      }
    };

    window.addEventListener("pointerdown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
    };
  }, []);

  const playActivitySound = async () => {
    if (!audioUnlockedRef.current || !audioContextRef.current) {
      return;
    }

    try {
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      const context = audioContextRef.current;
      const firstOscillator = context.createOscillator();
      const secondOscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime;

      firstOscillator.type = "sine";
      firstOscillator.frequency.setValueAtTime(880, startAt);
      secondOscillator.type = "sine";
      secondOscillator.frequency.setValueAtTime(1174, startAt + 0.18);

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.14);
      gain.gain.setValueAtTime(0.0001, startAt + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.34);

      firstOscillator.connect(gain);
      secondOscillator.connect(gain);
      gain.connect(context.destination);

      firstOscillator.start(startAt);
      firstOscillator.stop(startAt + 0.14);
      secondOscillator.start(startAt + 0.18);
      secondOscillator.stop(startAt + 0.34);
    } catch {
      // Ignore audio failures and keep the visual alert path active.
    }
  };

  const buildReservationParams = () => {
    const params = new URLSearchParams();

    if (displayMode === "calendar") {
      const range = getCalendarRange(calendarView, anchorDate);
      params.set("dateFrom", toDateInputValue(range.start));
      params.set("dateTo", toDateInputValue(range.end));
    } else if (date) {
      params.set("date", date);
    } else {
      params.set("includePast", "true");
    }

    if (status !== "ALL") params.set("status", status);

    return params;
  };

  const loadReservations = async (options: LoadReservationsOptions = {}) => {
    if (requestInFlightRef.current) {
      return;
    }

    const source = options.source ?? "filter";

    requestInFlightRef.current = true;

    if (options.foreground) {
      setLoading(true);
    }

    if (source === "manual") {
      setRefreshing(true);
    }

    setError("");

    try {
      const response = await fetch(
        `/api/admin/reservations?${buildReservationParams().toString()}`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!result.ok) {
        setError(formatApiError(result, reservationsCopy.loadError));
        if (source !== "poll") {
          setReservations([]);
          latestReservationsRef.current = [];
        }
        return;
      }

      const nextReservations = result.data.reservations as AdminReservation[];
      const previousReservations = latestReservationsRef.current;

      if (
        source === "poll" &&
        previousReservations &&
        !suppressChangeAlertsRef.current
      ) {
        const nextActivity = detectReservationActivity(
          previousReservations,
          nextReservations,
        );

        if (nextActivity.length > 0) {
          setActivityItems(nextActivity);
          setActivityDialogOpen(true);
          void playActivitySound();
        }
      }

      latestReservationsRef.current = nextReservations;
      hasLoadedOnceRef.current = true;
      setReservations(nextReservations);
    } catch {
      setError(reservationsCopy.loadError);
    } finally {
      if (source !== "poll") {
        suppressChangeAlertsRef.current = false;
      }

      requestInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadReservations({
      foreground: true,
      source: hasLoadedOnceRef.current ? "filter" : "initial",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode, calendarView, anchorDate, date, status]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadReservations({ source: "poll" });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
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
    suppressChangeAlertsRef.current = true;

    const response = await fetch("/api/admin/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json();

    if (!result.ok) {
      setError(formatApiError(result, reservationsCopy.createError));
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
      await loadReservations({ source: "mutation" });
    }

    setSaving(false);
  };

  const updateReservation = async (id: string, body: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    suppressChangeAlertsRef.current = true;

    const response = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (!result.ok) {
      setError(formatApiError(result, reservationsCopy.updateError));
    }

    await loadReservations({ source: "mutation" });
    setSaving(false);
  };

  const applyStatusAction = async (
    reservation: AdminReservation,
    action: (typeof statusActionMeta)[number]["action"],
  ) => {
    if (action === "cancel") {
      const confirmed = window.confirm(reservationsCopy.cancelConfirmation);

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
      setError(reservationsCopy.copyError);
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

  const closeActionMenu = () => {
    setOpenActionMenuId(null);
  };

  const getActivityLabel = (activityKind: ReservationActivityKind) => {
    if (activityKind === "new") {
      return reservationsCopy.activity.changeLabels.new;
    }

    if (activityKind === "cancelled") {
      return reservationsCopy.activity.changeLabels.cancelled;
    }

    return reservationsCopy.activity.changeLabels.updated;
  };

  const openReservationFromActivity = (reservationId: string) => {
    const reservation = reservations.find((item) => item.id === reservationId);

    if (!reservation) {
      setActivityDialogOpen(false);
      return;
    }

    setActivityDialogOpen(false);
    openReservationDialog(reservation);
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

  const renderActionMenu = (
    reservation: AdminReservation,
    options?: {
      fullWidth?: boolean;
      className?: string;
      style?: { background: string; border: string; color: string };
      summaryContent?: React.ReactNode;
      ariaLabel?: string;
    },
  ) => (
    <div
      ref={(element) => {
        actionMenuRefs.current[reservation.id] = element;
      }}
      className={`relative ${options?.fullWidth ? "w-full" : ""}`}
    >
      <button
        type="button"
        className={
          options?.className ??
          buttonClass
        }
        style={options?.style ?? quietButtonStyle}
        aria-label={options?.ariaLabel ?? reservationsCopy.actions}
        aria-expanded={openActionMenuId === reservation.id}
        onClick={(event) => {
          event.stopPropagation();
          setOpenActionMenuId((current) =>
            current === reservation.id ? null : reservation.id,
          );
        }}
      >
        {options?.summaryContent ?? reservationsCopy.actions}
      </button>
      {openActionMenuId === reservation.id ? (
        <div className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded border border-[#062F24]/10 bg-white p-2 text-left shadow-sm">
        <button
          type="button"
          className={actionMenuItemClass}
          onClick={() => {
            closeActionMenu();
            openReservationDialog(reservation);
          }}
        >
          {reservationsCopy.actionMenu.editReservation}
        </button>
        <button
          type="button"
          className={actionMenuItemClass}
          onClick={() => {
            closeActionMenu();
            void copyText(reservation, getManageUrl(reservation));
          }}
        >
          {reservationsCopy.actionMenu.copyManageLink}
        </button>
        <button
          type="button"
          className={actionMenuItemClass}
          onClick={() => {
            closeActionMenu();
            void copyText(reservation, reservation.confirmationCode);
          }}
        >
          {reservationsCopy.actionMenu.copyConfirmationCode}
        </button>
        <button
          type="button"
          className={actionMenuItemClass}
          onClick={() => {
            closeActionMenu();
            void copyText(reservation, reservation.guest.phone);
          }}
        >
          {reservationsCopy.actionMenu.copyGuestPhone}
        </button>
        <Link
          className={actionMenuItemClass}
          href={reservation.manageUrlPath}
          target="_blank"
          rel="noreferrer"
          onClick={closeActionMenu}
        >
          {reservationsCopy.actionMenu.openManagePage}
        </Link>
        {reservation.guest.email ? (
          <a
            className={actionMenuItemClass}
            href={`mailto:${reservation.guest.email}`}
            onClick={closeActionMenu}
          >
            {reservationsCopy.actionMenu.emailGuest}
          </a>
        ) : null}
        <a
          className={actionMenuItemClass}
          href={`tel:${reservation.guest.phone}`}
          onClick={closeActionMenu}
        >
          {reservationsCopy.actionMenu.callGuest}
        </a>
        {copiedReservationId === reservation.id ? (
          <p className="px-3 py-2.5 text-sm font-semibold text-[#062F24]/60">
            {reservationsCopy.actionMenu.copied}
          </p>
        ) : null}
        </div>
      ) : null}
    </div>
  );

  const renderCalendarEvent = (reservation: AdminReservation, compact = false) => (
    <div
      key={reservation.id}
      role="button"
      tabIndex={0}
      className="min-w-0 cursor-pointer overflow-hidden rounded border p-3 text-left shadow-sm transition hover:bg-white/70 focus:outline-none focus-visible:outline-none"
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
      <div className="min-w-0 grid gap-1">
        <p className="truncate text-[10px] font-semibold uppercase tracking-normal">
          {formatDisplayTime(reservation.time, language)}
        </p>
        <p className="line-clamp-2 break-words text-xs font-semibold leading-snug">
          {reservation.guest.name}
        </p>
        <p className="text-[10px] font-semibold">
          {reservation.partySize} {reservationsCopy.guests}
        </p>
      </div>
      {!compact ? (
        <div className="mt-2 grid gap-2">
          <p className="truncate text-[11px] font-medium">
            {formatPhoneNumber(reservation.guest.phone)}
          </p>
          <div className="grid gap-2">
            <p className="text-[10px] font-semibold">
              {statusMeta[reservation.status].label}
            </p>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded px-3 py-2 text-xs font-semibold transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:outline-0"
              onClick={(event) => {
                event.stopPropagation();
                openReservationDialog(reservation);
              }}
              style={{
                background: statusMeta[reservation.status].color,
                border: `1px solid ${statusMeta[reservation.status].color}`,
                color: "#FFFFFF",
              }}
            >
              {reservationsCopy.openDetails}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderReservationListItem = (reservation: AdminReservation) => (
    <div
      key={reservation.id}
      className="border-b border-l-4 border-b-[#062F24]/10 p-5 last:border-b-0"
      style={{ borderLeftColor: statusMeta[reservation.status].color }}
    >
      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="font-semibold text-[#062F24]">
            {formatHumanDate(reservation.date, language)} {formatDisplayTime(reservation.time, language)}
          </p>
          <p className="text-sm text-[#062F24]/65">
            {reservation.partySize} {reservationsCopy.guests}
          </p>
          <div className="mt-3">{renderStatusPill(reservation)}</div>
          <p className="mt-2 text-xs font-medium text-[#062F24]/60">
            {statusMeta[reservation.status].description}
          </p>
          <p className="mt-3 text-xs font-medium text-[#062F24]/55">
            {reservationsCopy.code}: {reservation.confirmationCode}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              onClick={() => openReservationDialog(reservation)}
              style={primaryButtonStyle}
            >
              {reservationsCopy.openDetails}
            </button>
            {renderActionMenu(reservation, {
              className:
                "inline-flex h-10 w-10 items-center justify-center rounded bg-transparent text-[#062F24] transition hover:bg-[rgba(6,47,36,0.05)] focus-visible:outline-none focus-visible:outline-0",
              style: {
                background: "transparent",
                border: "1px solid transparent",
                color: "#062F24",
              },
              summaryContent: <Ellipsis size={18} aria-hidden="true" />,
              ariaLabel: reservationsCopy.actions,
            })}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#062F24]">{reservation.guest.name}</p>
          <p className="mt-1 text-sm text-[#062F24]/65">
            {formatPhoneNumber(reservation.guest.phone)}
          </p>
          {reservation.guest.email ? (
            <p className="mt-1 text-sm text-[#062F24]/65">{reservation.guest.email}</p>
          ) : null}
          {reservation.specialRequests ? (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-[#062F24]/45">
                {reservationsCopy.notes}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#062F24]/70">
                {reservation.specialRequests}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderListSection = (
    title: string,
    emptyMessage: string,
    items: AdminReservation[],
  ) => (
    <section className="overflow-visible rounded border border-[#062F24]/10 bg-white shadow-sm">
      <div className="border-b border-[#062F24]/10 px-5 py-4">
        <h3 className="text-base font-semibold text-[#062F24]">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="p-5 text-sm text-[#062F24]/60">{emptyMessage}</p>
      ) : (
        items.map((reservation) => renderReservationListItem(reservation))
      )}
    </section>
  );

  const renderCalendar = () => {
    const range = getCalendarRange(calendarView, anchorDate);
    const days = getDatesBetween(range.start, range.end);

    if (calendarView === "month") {
      return (
        <div className="overflow-hidden rounded border border-[#062F24]/10 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-[#062F24]/10 bg-[rgba(6,47,36,0.04)]">
            {reservationsCopy.weekdayShort.map((day) => (
              <div key={day} className="p-3 text-xs font-semibold text-[#062F24]/60">
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
                  style={{ background: inactive ? "rgba(6,47,36,0.03)" : "#FFFFFF" }}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-sm font-semibold text-[#062F24]"
                      onClick={() => {
                        setAnchorDate(day);
                        setCalendarView("day");
                      }}
                    >
                      {day.getDate()}
                    </button>
                    {dayReservations.length ? (
                      <span className="rounded bg-[rgba(6,47,36,0.08)] px-2 py-1 text-[10px] font-semibold text-[#062F24]">
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
                        +{dayReservations.length - 4} {reservationsCopy.more}
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
        <div className="overflow-x-auto rounded border border-[#062F24]/10 bg-white shadow-sm">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[88px_repeat(7,minmax(112px,1fr))] border-b border-[#062F24]/10 bg-[rgba(6,47,36,0.04)]">
              <div className="p-3 text-xs font-semibold text-[#062F24]/45">
                {reservationsCopy.time}
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
                  <p className="text-xs font-semibold text-[#062F24]/50">
                    {reservationsCopy.weekdayShort[day.getDay()]}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[#062F24]">{day.getDate()}</p>
                </button>
              ))}
            </div>
            {slotTimes.map((time) => (
              <div
                key={time}
                className="grid grid-cols-[88px_repeat(7,minmax(112px,1fr))] border-b border-[#062F24]/10 last:border-b-0"
              >
                <div className="bg-[rgba(6,47,36,0.04)] p-3 text-xs font-semibold text-[#062F24]/55">
                  {formatDisplayTime(time, language)}
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
      <div className="rounded border border-[#062F24]/10 bg-white shadow-sm">
        {slotTimes.map((time) => {
          const slotReservations = reservationsAtSlot(reservations, selectedDate, time);

          return (
            <div
              key={time}
              className="grid gap-4 border-b border-[#062F24]/10 p-4 last:border-b-0 sm:grid-cols-[120px_1fr]"
            >
              <div>
                <p className="text-sm font-semibold text-[#062F24]">
                  {formatDisplayTime(time, language)}
                </p>
                <p className="text-xs font-semibold text-[#062F24]/50">
                  {slotReservations.reduce((total, reservation) => total + reservation.partySize, 0)} {reservationsCopy.guests}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {slotReservations.length ? (
                  slotReservations.map((reservation) => renderCalendarEvent(reservation))
                ) : (
                  <p className="rounded border border-dashed border-[#062F24]/15 p-4 text-sm font-semibold text-[#062F24]/45">
                    {reservationsCopy.noReservations}
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
        panelClassName="max-w-3xl rounded border border-[rgba(6,47,36,0.08)] bg-white p-6 shadow-sm sm:p-8"
      >
          <div className="flex flex-col justify-between gap-4 border-b border-[#062F24]/10 pb-5 sm:flex-row sm:items-start">
            <div>
              <h2 id="reservation-dialog-title" className="text-3xl font-extrabold text-[#062F24]">
                {selectedReservation.guest.name}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {renderStatusPill(selectedReservation)}
                <span className="rounded bg-[rgba(6,47,36,0.08)] px-3 py-1 text-xs font-semibold text-[#062F24]">
                  {selectedReservation.confirmationCode}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded bg-transparent text-[#062F24] transition hover:bg-[rgba(6,47,36,0.05)] focus-visible:outline-none focus-visible:outline-0"
                onClick={closeReservationDialog}
                aria-label={reservationsCopy.dialog.close}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.guestName}
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
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.phone}
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
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-[#062F24]/55 md:col-span-2">
              {reservationsCopy.dialog.email}
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
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.date}
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
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.time}
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
                    {formatDisplayTime(time, language)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.partySize}
              <input
                className={`${fieldClass} mt-2 md:max-w-[220px]`}
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
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.specialRequests}
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
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.internalNotes}
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

          <div className="mt-6 rounded border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] p-4">
            <p className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.statusActions}
            </p>
            {isTerminalStatus(selectedReservation.status) ? (
              <p className="mt-2 text-sm font-semibold text-[#062F24]">
                {reservationsCopy.dialog.finalState}: {statusMeta[selectedReservation.status].label}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {statusActionMeta.map((statusAction) => {
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
                    {isCurrentStatus
                      ? statusAction.action === "complete"
                        ? reservationsCopy.statusActions.completed
                        : statusAction.action === "no_show"
                          ? reservationsCopy.statusActions.noShowActive
                          : reservationsCopy.statusActions.cancelled
                      : statusAction.action === "complete"
                        ? reservationsCopy.statusActions.complete
                        : statusAction.action === "no_show"
                          ? reservationsCopy.statusActions.noShow
                          : reservationsCopy.statusActions.cancel}
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
              style={quietButtonStyle}
            >
              {reservationsCopy.dialog.discard}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={saveReservationDialog}
              disabled={saving}
              style={primaryButtonStyle}
            >
              {saving ? <Loader2 size={14} className="mr-2 inline animate-spin" aria-hidden="true" /> : null}
              {saving ? reservationsCopy.dialog.saving : reservationsCopy.dialog.saveChanges}
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
        panelClassName="max-w-2xl rounded border border-[rgba(6,47,36,0.08)] bg-white p-6 shadow-sm sm:p-8"
      >
          <div className="flex items-start justify-between gap-4 border-b border-[#062F24]/10 pb-5">
            <div>
              <h2 id="create-reservation-dialog-title" className="text-3xl font-extrabold text-[#062F24]">
                {reservationsCopy.createDialog.title}
              </h2>
            </div>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setCreateDialogOpen(false)}
              style={quietButtonStyle}
            >
              {reservationsCopy.dialog.close}
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.date}
              <input
                className={`${fieldClass} mt-2`}
                type="date"
                name="new-reservation-date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.time}
              <select
                className={`${fieldClass} mt-2`}
                name="new-reservation-time"
                value={form.time}
                onChange={(event) => setForm({ ...form, time: event.target.value })}
              >
                {slotTimes.map((time) => (
                  <option key={time} value={time}>
                    {formatDisplayTime(time, language)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.partySize}
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
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.guestName}
              <input
                className={`${fieldClass} mt-2`}
                name="new-guest-name"
                autoComplete="name"
                placeholder={reservationsCopy.createDialog.guestNamePlaceholder}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.phone}
              <input
                className={`${fieldClass} mt-2`}
                name="new-guest-phone"
                autoComplete="tel"
                inputMode="tel"
                placeholder={reservationsCopy.createDialog.phonePlaceholder}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-[#062F24]/55 md:col-span-2">
              {reservationsCopy.dialog.email}
              <input
                className={`${fieldClass} mt-2`}
                type="email"
                name="new-guest-email"
                autoComplete="email"
                spellCheck={false}
                placeholder={reservationsCopy.createDialog.emailPlaceholder}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.specialRequests}
              <textarea
                className={`${fieldClass} mt-2 min-h-[120px]`}
                name="new-special-requests"
                placeholder={reservationsCopy.createDialog.specialRequestsPlaceholder}
                value={form.specialRequests}
                onChange={(event) =>
                  setForm({ ...form, specialRequests: event.target.value })
                }
              />
            </label>
            <label className="text-xs font-semibold text-[#062F24]/55">
              {reservationsCopy.dialog.internalNotes}
              <textarea
                className={`${fieldClass} mt-2 min-h-[120px]`}
                name="new-internal-notes"
                placeholder={reservationsCopy.createDialog.internalNotesPlaceholder}
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
              style={quietButtonStyle}
            >
              {reservationsCopy.createDialog.discard}
            </button>
            <button
              type="button"
              onClick={createReservation}
              disabled={saving}
              className={buttonClass}
              style={primaryButtonStyle}
            >
              {saving ? <Loader2 size={14} className="mr-2 inline animate-spin" aria-hidden="true" /> : null}
              {saving ? reservationsCopy.createDialog.saving : reservationsCopy.createDialog.createReservation}
            </button>
          </div>
      </ModalShell>
    );
  };

  const renderActivityDialog = () => {
    if (!activityDialogOpen || activityItems.length === 0) return null;

    return (
      <ModalShell
        labelledBy="reservation-activity-title"
        onClose={() => setActivityDialogOpen(false)}
        panelClassName="max-w-2xl rounded border border-[rgba(6,47,36,0.08)] bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#062F24]/10 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(6,47,36,0.08)] px-3 py-1 text-xs font-semibold text-[#062F24]">
              <Bell size={14} aria-hidden="true" />
              {reservationsCopy.activity.live}
            </div>
            <h2
              id="reservation-activity-title"
              className="mt-3 text-3xl font-extrabold text-[#062F24]"
            >
              {reservationsCopy.activity.title}
            </h2>
            <p className="mt-2 text-sm text-[#062F24]/65">
              {reservationsCopy.activity.description}
            </p>
          </div>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setActivityDialogOpen(false)}
            style={quietButtonStyle}
          >
            {reservationsCopy.activity.dismiss}
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {activityItems.map((activity) => (
            <button
              key={`${activity.kind}-${activity.reservation.id}-${activity.reservation.updatedAt}`}
              type="button"
              onClick={() => openReservationFromActivity(activity.reservation.id)}
              className="grid gap-3 rounded border border-[#062F24]/10 bg-[rgba(6,47,36,0.03)] p-4 text-left transition hover:bg-[rgba(6,47,36,0.06)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded px-3 py-1 text-xs font-bold text-[#062F24]">
                  {getActivityLabel(activity.kind)}
                </span>
                {renderStatusPill(activity.reservation)}
              </div>
              <div>
                <p className="text-base font-semibold text-[#062F24]">
                  {activity.reservation.guest.name}
                </p>
                <p className="mt-1 text-sm text-[#062F24]/65">
                  {formatHumanDate(activity.reservation.date, language)} •{" "}
                  {formatDisplayTime(activity.reservation.time, language)} •{" "}
                  {activity.reservation.partySize} {reservationsCopy.guests}
                </p>
              </div>
              <p className="text-sm font-semibold text-[#062F24]">
                {reservationsCopy.activity.openReservation}
              </p>
            </button>
          ))}
        </div>
      </ModalShell>
    );
  };

  const todayValue = today();
  const todayReservations = reservations
    .filter((reservation) => reservation.date === todayValue)
    .sort(compareReservationsAscending);
  const upcomingReservations = reservations
    .filter((reservation) => reservation.date > todayValue)
    .sort(compareReservationsAscending);
  const pastReservations = reservations
    .filter((reservation) => reservation.date < todayValue)
    .sort(compareReservationsDescending);

  return (
    <section className="pb-20 pt-36 lg:pt-40" style={{ background: "#FFFFFF" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-extrabold leading-none text-[#062F24]">
              {reservationsCopy.title}
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
              {reservationsCopy.createReservation}
            </button>
            <Link href="/admin/settings" className={buttonClass} style={quietButtonStyle}>
              {reservationsCopy.settings}
            </Link>
            <button type="button" onClick={signOut} className={buttonClass} style={quietButtonStyle}>
              {reservationsCopy.signOut}
            </button>
          </div>
        </div>

        {error ? (
          <p
            className="mt-6 rounded border border-red-900/20 bg-red-900/10 p-4 text-sm text-red-800"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-8">
          <div>
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDisplayMode("calendar")}
                  className={buttonClass}
                  style={{
                    ...(displayMode === "calendar" ? primaryButtonStyle : quietButtonStyle),
                  }}
                >
                  <CalendarDays size={14} className="mr-2 inline" />
                  {reservationsCopy.calendar}
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode("list")}
                  className={buttonClass}
                  style={{
                    ...(displayMode === "list" ? primaryButtonStyle : quietButtonStyle),
                  }}
                >
                  <ListChecks size={14} className="mr-2 inline" />
                  {reservationsCopy.list}
                </button>
              </div>

              <select
                className={`${fieldClass} lg:max-w-[220px]`}
                value={status}
                aria-label={reservationsCopy.filterByStatus}
                onChange={(event) => {
                  const nextStatus = event.target.value;
                  setStatus(
                    isAdminReservationStatus(nextStatus) ? nextStatus : "ALL",
                  );
                }}
              >
                <option value="ALL">{reservationsCopy.allStatuses}</option>
                <option value="PENDING">{reservationsCopy.statusLabels.PENDING}</option>
                <option value="CONFIRMED">{reservationsCopy.statusLabels.CONFIRMED}</option>
                <option value="CANCELLED">{reservationsCopy.statusLabels.CANCELLED}</option>
                <option value="COMPLETED">{reservationsCopy.statusLabels.COMPLETED}</option>
                <option value="NO_SHOW">{reservationsCopy.statusLabels.NO_SHOW}</option>
              </select>
            </div>

            {displayMode === "calendar" ? (
              <div className="mt-4 rounded border border-[#062F24]/10 bg-[rgba(6,47,36,0.04)] p-3 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => setAnchorDate(parseDateInput(today()))}
                      style={primaryButtonStyle}
                    >
                      {reservationsCopy.currentPeriod[calendarView]}
                    </button>
                  </div>

                  <div className="flex min-w-0 flex-1 items-center justify-start gap-6 xl:justify-center">
                    <button
                      type="button"
                      aria-label={`${reservationsCopy.previous} ${reservationsCopy.viewOptions[calendarView].toLowerCase()}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent text-[#062F24] transition hover:bg-[rgba(6,47,36,0.05)]"
                      onClick={() =>
                        setAnchorDate(
                          moveAnchorDate(calendarView, anchorDate, -1),
                        )
                      }
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <div className="min-w-0 text-left xl:text-center">
                      <p className="truncate text-3xl font-extrabold leading-tight text-[#062F24]">
                        {getCalendarTitle(calendarView, anchorDate, language)}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label={`${reservationsCopy.next} ${reservationsCopy.viewOptions[calendarView].toLowerCase()}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent text-[#062F24] transition hover:bg-[rgba(6,47,36,0.05)]"
                      onClick={() =>
                        setAnchorDate(
                          moveAnchorDate(calendarView, anchorDate, 1),
                        )
                      }
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div className="inline-flex w-full rounded border border-[#062F24]/10 bg-white p-1 sm:w-auto">
                    {(["day", "week", "month"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        className="flex-1 rounded px-4 py-2 text-xs font-semibold transition sm:flex-none"
                        onClick={() => setCalendarView(view)}
                        style={{
                          ...(calendarView === view
                            ? primaryButtonStyle
                            : { background: "transparent", color: "#062F24", border: "1px solid transparent" }),
                        }}
                      >
                        {reservationsCopy.viewOptions[view]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  className={fieldClass}
                  type="date"
                  aria-label={reservationsCopy.filterListByDate}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                <button type="button" onClick={() => setDate("")} className={buttonClass} style={quietButtonStyle}>
                  {reservationsCopy.allDates}
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center gap-3 rounded border border-[#062F24]/10 bg-white p-6 text-[#062F24] shadow-sm">
                <Loader2 size={16} className="animate-spin" />
                {reservationsCopy.loading}
              </div>
            ) : null}

            {!loading && displayMode === "calendar" ? (
              <div className="mt-4">{renderCalendar()}</div>
            ) : null}

            {!loading && displayMode === "list" ? (
              <div className="mt-6 grid gap-5">
                {renderListSection(
                  reservationsCopy.today,
                  reservationsCopy.emptyToday,
                  todayReservations,
                )}
                {renderListSection(
                  reservationsCopy.upcoming,
                  reservationsCopy.emptyUpcoming,
                  upcomingReservations,
                )}
                {renderListSection(
                  reservationsCopy.past,
                  reservationsCopy.emptyPast,
                  pastReservations,
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {renderReservationDialog()}
      {renderCreateDialog()}
      {renderActivityDialog()}
      <div
        className="fixed bottom-4 left-4 z-[60] sm:bottom-6 sm:left-6"
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom))",
          left: "max(1rem, env(safe-area-inset-left))",
        }}
      >
        <button
          type="button"
          onClick={() => void loadReservations({ source: "manual" })}
          disabled={refreshing || loading}
          aria-label={refreshing ? reservationsCopy.refreshing : reservationsCopy.refresh}
          className="inline-flex min-h-0 items-center rounded border border-white/20 bg-[#062F24] p-1 transition-all"
        >
          <span className="inline-flex min-h-0 items-center gap-2 rounded-sm px-3 py-2 text-xs font-semibold leading-none text-white">
            <RotateCw
              size={14}
              aria-hidden="true"
              className={refreshing || loading ? "animate-spin" : ""}
            />
            {refreshing || loading
              ? reservationsCopy.refreshing
              : reservationsCopy.refresh}
          </span>
        </button>
      </div>
    </section>
  );
}
