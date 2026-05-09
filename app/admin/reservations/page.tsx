import AdminReservationsDashboard from "@/components/admin/admin-reservations-dashboard";
import SiteShell from "@/components/site-shell";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function AdminReservationsPage() {
  await requireAdminUser();

  return (
    <SiteShell>
      <AdminReservationsDashboard />
    </SiteShell>
  );
}
