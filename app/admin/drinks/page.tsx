import AdminDrinksPage from "@/components/admin/admin-drinks-page";
import AdminWorkspaceNav from "@/components/admin/admin-workspace-nav";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function AdminDrinksRoute() {
  await requireAdminUser();
  return (
    <>
      <AdminWorkspaceNav
        label="Menu workspace"
        items={[
          { href: "/admin/menu", label: "Delivery menu", selected: false },
          { href: "/admin/drinks", label: "Drinks", selected: true },
        ]}
      />
      <AdminDrinksPage />
    </>
  );
}
