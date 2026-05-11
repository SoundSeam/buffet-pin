"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import ManageReservationPage from "@/components/reservation/manage-reservation-page";
import SiteShell from "@/components/site-shell";

function ManageReservationFromQuery() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  return <ManageReservationPage token={token} />;
}

export default function ReservationManagePage() {
  return (
    <SiteShell>
      <Suspense fallback={null}>
        <ManageReservationFromQuery />
      </Suspense>
    </SiteShell>
  );
}
