import SiteShell from "@/components/site-shell";
import AdminSettingsPage from "@/components/admin/admin-settings-page";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function AdminSettingsRoute() {
  await requireAdminUser();

  return (
    <SiteShell>
      <AdminSettingsPage />
    </SiteShell>
  );
}
