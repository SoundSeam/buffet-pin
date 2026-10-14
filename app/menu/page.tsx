import SiteShell from "@/components/site-shell";
import PublicMenu from "@/components/menu/public-menu";
import { buildDisplayMenu } from "@/lib/menu/display-menu";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Menu",
  description: "Découvrez les plats et combos de Buffet Pin, avec leurs prix. Menu pour consultation seulement. Explore our dishes and combos.",
  pathname: "/menu",
});

export default function MenuPage() {
  return <SiteShell><PublicMenu categories={buildDisplayMenu()} /></SiteShell>;
}
