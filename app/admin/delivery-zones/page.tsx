import { redirect } from "next/navigation";
import { requireStaffUser } from "@/lib/supabase/auth";

export default async function AdminDeliveryZonesRoute() {
  await requireStaffUser("SETTINGS_WRITE");

  redirect("/admin/settings?view=delivery");
}
