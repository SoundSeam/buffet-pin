import { requireStaffUser } from "@/lib/supabase/auth";
import DriverOperationsPage from "@/components/admin/driver-operations-page";

export default async function DriverOperationsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffUser("DISPATCH_WRITE");
  const { id } = await params;
  return <DriverOperationsPage driverId={id} />;
}
