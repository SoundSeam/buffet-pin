import MachineTestPage from "@/components/admin/machine-test-page";
import { requireStaffUser } from "@/lib/supabase/auth";

export default async function DeveloperMachineTest() {
  await requireStaffUser("DEV_TOOLS");
  return <MachineTestPage />;
}
