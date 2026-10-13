import { redirect } from "next/navigation";

import AdminMenuPage from "@/components/admin/admin-menu-page";
import AdminDrinksPage from "@/components/admin/admin-drinks-page";
import AdminWorkspaceNav from "@/components/admin/admin-workspace-nav";
import { requireAdminUser } from "@/lib/supabase/auth";

type MenuView = "delivery" | "drinks";

export default async function AdminMenuRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();
  const query = await searchParams;
  const requested = Array.isArray(query.view) ? query.view[0] : query.view;
  if (requested === "clover") redirect("/dev/clover/catalog");
  const view: MenuView = ["delivery", "drinks"].includes(requested ?? "")
    ? (requested as MenuView)
    : "delivery";

  return (
    <>
      <AdminWorkspaceNav
        label="Menu workspace"
        items={[
          {
            href: "/admin/menu",
            label: "Delivery menu",
            selected: view === "delivery",
          },
          {
            href: "/admin/drinks",
            label: "Drinks",
            selected: view === "drinks",
          },
        ]}
      />
      {view === "delivery" ? <AdminMenuPage /> : null}
      {view === "drinks" ? <AdminDrinksPage /> : null}
    </>
  );
}
