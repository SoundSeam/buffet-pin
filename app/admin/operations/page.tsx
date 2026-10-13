import { redirect } from "next/navigation";
import { legacyAudienceRedirects } from "@/lib/audience-routes";
export default async function OperationsPage() {
  redirect(legacyAudienceRedirects.operations);
}
