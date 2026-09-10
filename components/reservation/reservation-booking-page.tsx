"use client";

import { useOnlineReservationsEnabled } from "@/components/providers/reservation-availability-provider";
import ReservationForm from "@/components/reservation/reservation-form";
import ReservationCallMessage from "@/components/reservation/reservation-call-message";

export default function ReservationBookingPage() {
  const enabled = useOnlineReservationsEnabled();
  return enabled ? <ReservationForm /> : <ReservationCallMessage />;
}
