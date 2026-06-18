import SiteShell from "@/components/site-shell";
import AdminMenuPage from "@/components/admin/admin-menu-page";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function AdminMenuRoute() {
  await requireAdminUser();

  return (
    <SiteShell>
      <AdminMenuPage />
    </SiteShell>
  );
}
