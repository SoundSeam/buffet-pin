import type { Metadata } from "next";

import SiteShell from "@/components/site-shell";
import ReservationForm from "@/components/reservation/reservation-form";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Réserver une table à Châteauguay",
  description:
    "Réservez votre table chez Buffet Pin à Châteauguay. Réservation en ligne pour groupes, confirmation rapide, coordonnées et informations pratiques.",
  pathname: "/reservation",
});

export default function ReservationPage() {
  return (
    <SiteShell>
      <ReservationForm />
    </SiteShell>
  );
}
