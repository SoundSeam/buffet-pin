import type { Metadata } from "next";

import SiteShell from "@/components/site-shell";
import ReservationBookingPage from "@/components/reservation/reservation-booking-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Réserver une table à Châteauguay",
  description:
    "Réservez votre table chez Buffet Pin à Châteauguay. Réservation pour groupes, coordonnées et informations pratiques. Appelez le (450) 699-8088.",
  pathname: "/reservation",
});

export default function ReservationPage() {
  return (
    <SiteShell>
      <ReservationBookingPage />
    </SiteShell>
  );
}
