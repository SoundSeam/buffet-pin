import OperationsConsole from "@/components/admin/operations-console";
import { requireStaffUser } from "@/lib/supabase/auth";

export default async function DeveloperOperations() {
  await requireStaffUser("DEV_TOOLS");
  return <OperationsConsole canManageRefunds={false} />;
}
