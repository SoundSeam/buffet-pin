import AdminDrinksPage from "@/components/admin/admin-drinks-page";
import SiteShell from "@/components/site-shell";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function AdminDrinksRoute() {
  await requireAdminUser();

  return (
    <SiteShell>
      <AdminDrinksPage />
    </SiteShell>
  );
}
