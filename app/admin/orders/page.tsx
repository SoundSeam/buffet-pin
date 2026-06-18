import AdminOrdersDashboard from "@/components/admin/admin-orders-dashboard";
import SiteShell from "@/components/site-shell";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function AdminOrdersPage() {
  await requireAdminUser();

  return (
    <SiteShell>
      <AdminOrdersDashboard />
    </SiteShell>
  );
}
