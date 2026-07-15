import type { Metadata } from "next";

import DrinksMenuPage from "@/components/drinks/drinks-menu-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Menu des boissons",
  description:
    "Consultez le menu des boissons de Buffet Pin : cocktails, vins, bières, sakés, boissons sans alcool, thés et cafés.",
  pathname: "/drinks",
});

export default function DrinksPage() {
  return <DrinksMenuPage />;
}
