import { redirect } from "next/navigation";

import AdminReservationsDashboard from "@/components/admin/admin-reservations-dashboard";
import { getAdminLandingPath } from "@/lib/admin-workspaces";
import { getStaffRole } from "@/lib/supabase/auth";

export default async function AdminReservationsPage() {
  const staffRole = await getStaffRole();
  if (!staffRole) redirect("/admin/login");
  if (staffRole !== "MANAGER") redirect(getAdminLandingPath(staffRole));

  return <AdminReservationsDashboard />;
}
