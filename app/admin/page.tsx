import { redirect } from "next/navigation";

import {
  getAdminLandingPath,
  resolveAdminOrderStage,
} from "@/lib/admin-workspaces";
import { getStaffRole } from "@/lib/supabase/auth";
import RestaurantHome from "@/components/admin/restaurant-home";

function selected(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [staffRole, query] = await Promise.all([getStaffRole(), searchParams]);
  if (!staffRole) redirect("/admin/login");

  if (staffRole === "MANAGER" && selected(query.area) === "orders") {
    redirect(
      `/admin/orders?stage=${resolveAdminOrderStage("MANAGER", selected(query.stage))}`,
    );
  }

  if (staffRole === "MANAGER" && selected(query.area) === "reservations") {
    const reservationParams = new URLSearchParams();
    for (const key of ["mode", "status", "view", "date", "listDate"]) {
      const value = selected(query[key]);
      if (value) reservationParams.set(key, value);
    }
    const search = reservationParams.toString();
    redirect(`/admin/reservations${search ? `?${search}` : ""}`);
  }

  if (staffRole !== "MANAGER") redirect(getAdminLandingPath(staffRole));

  return <RestaurantHome />;
}
