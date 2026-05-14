import type { Metadata } from "next";

import SiteShell from "@/components/site-shell";
import MenuHero from "@/components/menu/menu-hero";
import MenuSections from "@/components/menu/menu-sections";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Menu du buffet asiatique à Châteauguay",
  description:
    "Consultez un aperçu du menu de Buffet Pin à Châteauguay: sushis, plats chauds, wok, grillades, dim sum, desserts et saveurs asiatiques à volonté.",
  pathname: "/menu",
});

export default function MenuPage() {
  return (
    <SiteShell>
      <MenuHero />
      <MenuSections />
    </SiteShell>
  );
}
