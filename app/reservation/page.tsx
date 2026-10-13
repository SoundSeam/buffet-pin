import type { Metadata } from "next";
import { RESERVATIONS_ENABLED } from "@/lib/site-flags";

import SiteShell from "@/components/site-shell";
import ReservationForm from "@/components/reservation/reservation-form";
import ReservationCallMessage from "@/components/reservation/reservation-call-message";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Réserver une table à Châteauguay",
  description: RESERVATIONS_ENABLED
    ? "Réservez votre table chez Buffet Pin à Châteauguay. Réservation en ligne pour groupes, confirmation rapide, coordonnées et informations pratiques."
    : "Pour réserver chez Buffet Pin, appelez le (450) 699-8088.",
  pathname: "/reservation",
});

export default function ReservationPage() {
  return (
    <SiteShell>
      {RESERVATIONS_ENABLED ? <ReservationForm /> : <ReservationCallMessage />}
    </SiteShell>
  );
}
