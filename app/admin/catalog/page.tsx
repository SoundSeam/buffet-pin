import { redirect } from "next/navigation";
import { legacyAudienceRedirects } from "@/lib/audience-routes";
export default async function CatalogPage() {
  redirect(legacyAudienceRedirects.catalog);
}
