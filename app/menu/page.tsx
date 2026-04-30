import SiteShell from "@/components/site-shell";
import MenuSections from "@/components/menu/menu-sections";
import ValueProps from "@/components/home/value-props";
import CtaStrip from "@/components/home/cta-strip";

export default function MenuPage() {
  return (
    <SiteShell>
      <MenuSections />
      <ValueProps />
      <CtaStrip />
    </SiteShell>
  );
}
