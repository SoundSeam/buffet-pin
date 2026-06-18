import DriverOrdersPage from "@/components/driver/driver-orders-page";
import { requireDriverUser } from "@/lib/supabase/auth";

export default async function DriverOrdersRoutePage() {
  await requireDriverUser();

  return <DriverOrdersPage />;
}
