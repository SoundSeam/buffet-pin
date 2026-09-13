import type { Metadata, Viewport } from "next";

import DrinksMenuPage from "@/components/drinks/drinks-menu-page";
import SiteShell from "@/components/site-shell";
import { getPublicDrinkMenu } from "@/lib/drinks/menu";
import styles from "./page.module.css";
import { buildPageMetadata } from "@/lib/seo";

export const viewport: Viewport = { themeColor: "#020305" };

export const metadata: Metadata = buildPageMetadata({
  title: "Menu des boissons",
  description:
    "Consultez le menu des boissons de Buffet Pin : cocktails, vins, bières, sakés, boissons sans alcool, thés et cafés.",
  pathname: "/drinks",
});

export const dynamic = "force-dynamic";

export default async function DrinksPage() {
  const categories = await getPublicDrinkMenu();

  return (
    <div className={styles.page}>
      <SiteShell theme="drinks">
        <DrinksMenuPage categories={categories} />
      </SiteShell>
    </div>
  );
}
