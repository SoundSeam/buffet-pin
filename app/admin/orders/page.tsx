import AdminOrdersDashboard from "@/components/admin/admin-orders-dashboard";
import { requireStaffUser } from "@/lib/supabase/auth";

export default async function AdminOrdersPage() {
  await requireStaffUser("ORDERS_READ");
  return <AdminOrdersDashboard />;
}
