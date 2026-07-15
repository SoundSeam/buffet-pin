import type { Metadata } from "next";

import DrinksMenuPage from "@/components/drinks/drinks-menu-page";
import SiteShell from "@/components/site-shell";
import { getPublicDrinkMenu } from "@/lib/drinks/menu";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Menu des boissons",
  description:
    "Consultez le menu des boissons de Buffet Pin : cocktails, vins, bières, sakés, boissons sans alcool, thés et cafés.",
  pathname: "/drinks",
});

export default async function DrinksPage() {
  const categories = await getPublicDrinkMenu();

  return (
    <SiteShell>
      <DrinksMenuPage categories={categories} />
    </SiteShell>
  );
}
