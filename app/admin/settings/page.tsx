import "maplibre-gl/dist/maplibre-gl.css";

import { redirect } from "next/navigation";

import AdminSettingsPage from "@/components/admin/admin-settings-page";
import AdminDeliveryZonesPage from "@/components/admin/admin-delivery-zones-page";
import AdminOrderSettingsPage from "@/components/admin/admin-order-settings-page";
import AdminWorkspaceNav from "@/components/admin/admin-workspace-nav";
import { requireAdminUser } from "@/lib/supabase/auth";

type SettingsView = "reservations" | "ordering" | "delivery";

export default async function AdminSettingsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser();
  const query = await searchParams;
  const requested = Array.isArray(query.view) ? query.view[0] : query.view;
  if (requested === "diagnostics") redirect("/dev/machine-test");
  if (requested === "people") redirect("/admin/drivers");
  const view: SettingsView = ["reservations", "ordering", "delivery"].includes(
    requested ?? "",
  )
    ? (requested as SettingsView)
    : "ordering";

  return (
    <>
      <AdminWorkspaceNav
        label="Settings workspace"
        items={[
          {
            href: "/admin/settings",
            label: "Ordering",
            selected: view === "ordering",
          },
          {
            href: "/admin/settings?view=reservations",
            label: "Reservation capacity",
            selected: view === "reservations",
          },
          {
            href: "/admin/settings?view=delivery",
            label: "Delivery zones",
            selected: view === "delivery",
          },
        ]}
      />
      {view === "ordering" ? <AdminOrderSettingsPage /> : null}
      {view === "reservations" ? <AdminSettingsPage /> : null}
      {view === "delivery" ? <AdminDeliveryZonesPage /> : null}
    </>
  );
}
