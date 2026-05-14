import type { Metadata } from "next";

import SiteShell from "@/components/site-shell";
import CtaStrip from "@/components/home/cta-strip";
import HeroSection from "@/components/home/hero-section";
import ValueProps from "@/components/home/value-props";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Buffet asiatique à volonté à Châteauguay",
  description:
    "Découvrez Buffet Pin à Châteauguay: buffet asiatique à volonté, horaires, prix du midi et du soir, adresse, téléphone et réservation en ligne.",
  pathname: "/",
});

export default function HomePage() {
  return (
    <SiteShell>
      <HeroSection />
      <ValueProps />
      <CtaStrip />
    </SiteShell>
  );
}
