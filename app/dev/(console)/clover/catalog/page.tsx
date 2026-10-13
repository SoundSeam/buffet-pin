import CatalogOperationsPage from "@/components/admin/catalog-operations-page";
import { requireStaffUser } from "@/lib/supabase/auth";

export default async function DeveloperCatalog() {
  await requireStaffUser("DEV_TOOLS");
  return <CatalogOperationsPage />;
}
