import AuditHistoryPage from "@/components/dev/audit-history-page";
import { requireStaffUser } from "@/lib/supabase/auth";

export default async function DeveloperAudit() {
  await requireStaffUser("DEV_TOOLS");
  return <AuditHistoryPage />;
}
