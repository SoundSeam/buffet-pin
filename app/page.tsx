import SiteShell from "@/components/site-shell";
import CtaStrip from "@/components/home/cta-strip";
import HeroSection from "@/components/home/hero-section";
import ValueProps from "@/components/home/value-props";

export default function HomePage() {
  return (
    <SiteShell>
      <HeroSection />
      <ValueProps />
      <CtaStrip />
    </SiteShell>
  );
}
