import SiteShell from "@/components/site-shell";
import LocationHours from "@/components/home/value-props";
import ReservationForm from "@/components/reservation/reservation-form";

export default function ReservationPage() {
  return (
    <SiteShell>
      <ReservationForm />
      <LocationHours />
    </SiteShell>
  );
}
