import { redirect } from "next/navigation";

import { requireStaffUser } from "@/lib/supabase/auth";

export default async function ProductionPage() {
  await requireStaffUser("PRODUCTION_WRITE");
  redirect("/admin/orders");
}
