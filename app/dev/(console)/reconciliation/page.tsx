import ReconciliationConsole from "@/components/admin/reconciliation-console";
import { requireStaffUser } from "@/lib/supabase/auth";

export default async function DeveloperReconciliation() {
  await requireStaffUser("DEV_TOOLS");
  return <ReconciliationConsole />;
}
