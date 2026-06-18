import SiteShell from "@/components/site-shell";
import AdminOrderSettingsPage from "@/components/admin/admin-order-settings-page";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function AdminOrderSettingsRoute() {
  await requireAdminUser();

  return (
    <SiteShell>
      <AdminOrderSettingsPage />
    </SiteShell>
  );
}
