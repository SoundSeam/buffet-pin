import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function AdminOrderSettingsRoute() {
  await requireAdminUser();

  redirect("/admin/settings?view=ordering");
}
