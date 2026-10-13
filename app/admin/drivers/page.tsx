import AdminDriversPage from "@/components/admin/admin-drivers-page";
import DriverAvailabilityPage from "@/components/admin/driver-availability-page";
import {
  getStaffRole,
  requireStaffUserWithAnyCapability,
} from "@/lib/supabase/auth";

export default async function AdminDriversRoutePage() {
  await requireStaffUserWithAnyCapability(["STAFF_WRITE", "DISPATCH_WRITE"]);
  const role = await getStaffRole();
  return role === "MANAGER" ? <AdminDriversPage /> : <DriverAvailabilityPage />;
}
