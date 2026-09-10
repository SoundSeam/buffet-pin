"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const ReservationAvailabilityContext = createContext(false);

export function ReservationAvailabilityProvider({ initialEnabled, children }: {
  initialEnabled: boolean;
  children: ReactNode;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const pathname = usePathname();

  useEffect(() => setEnabled(initialEnabled), [initialEnabled]);
  useEffect(() => {
    const controller = new AbortController();
    let requestId = 0;
    const refresh = async () => {
      const id = ++requestId;
      try {
        const response = await fetch("/api/reservations/status", { cache: "no-store", signal: controller.signal });
        const result = response.ok ? await response.json() : null;
        if (!controller.signal.aborted && id === requestId) setEnabled(result?.onlineReservationsEnabled === true);
      } catch {
        if (!controller.signal.aborted && id === requestId) setEnabled(false);
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, initialEnabled]);

  return <ReservationAvailabilityContext.Provider value={enabled}>{children}</ReservationAvailabilityContext.Provider>;
}

export function useOnlineReservationsEnabled() {
  return useContext(ReservationAvailabilityContext);
}
