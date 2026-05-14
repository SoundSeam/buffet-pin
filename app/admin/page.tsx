import { redirect } from "next/navigation";

import { getAdminUser } from "@/lib/supabase/auth";

export default async function AdminPage() {
  const user = await getAdminUser();

  redirect(user ? "/admin/reservations" : "/admin/login");
}
