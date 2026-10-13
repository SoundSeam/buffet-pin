import { redirect } from "next/navigation";
import { legacyAudienceRedirects } from "@/lib/audience-routes";
export default async function ReconciliationPage() {
  redirect(legacyAudienceRedirects.reconciliation);
}
