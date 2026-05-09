import AdminSettingsDashboard from "@/components/admin/admin-settings-dashboard";
import SiteShell from "@/components/site-shell";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function AdminSettingsPage() {
  await requireAdminUser();

  return (
    <SiteShell>
      <AdminSettingsDashboard />
    </SiteShell>
  );
}
