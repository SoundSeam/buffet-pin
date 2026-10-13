import SystemHealthPage from "@/components/dev/system-health-page";
import { requireStaffUser } from "@/lib/supabase/auth";

export default async function DeveloperHome() {
  await requireStaffUser("DEV_TOOLS");
  return <SystemHealthPage />;
}
