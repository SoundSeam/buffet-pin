import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Power,
  Users,
} from "lucide-react";

import {
  AdminPage,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-page-ui";
import { db } from "@/lib/db";

const actions = [
  {
    href: "/admin/orders",
    label: "Kitchen Controller",
    icon: ClipboardList,
    key: "activeOrders",
  },
  {
    href: "/admin/drivers",
    label: "Available drivers",
    icon: Users,
    key: "drivers",
  },
] as const;

export default async function RestaurantHome() {
  const now = new Date();
  const [activeOrders, drivers, settings] =
    await Promise.all([
      db.order.count({
        where: {
          paymentStatus: "PAID",
          productionStatus: { notIn: ["REJECTED", "CANCELLED"] },
          dispatchStatus: { notIn: ["DELIVERED", "CANCELLED"] },
        },
      }),
      db.driver.count({
        where: {
          isActive: true,
          shifts: {
            some: {
              isActive: true,
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
          },
        },
      }),
      db.restaurantOrderSettings.findUnique({ where: { id: 1 } }),
    ]);

  const counts = { activeOrders, drivers };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Restaurant operations"
        description="What needs attention right now?"
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map(({ href, label, icon: Icon, key }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-40 touch-manipulation flex-col justify-between rounded-surface-lg border border-[#062F24]/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#062F24]/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#062F24] focus-visible:ring-offset-2"
          >
            <Icon className="h-8 w-8 text-[#062F24]" aria-hidden="true" />
            <span>
              <strong className="block text-3xl font-extrabold text-[#062F24]">
                {counts[key]}
              </strong>
              <span className="mt-1 block text-base font-semibold text-[#062F24]/70">
                {label}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <AdminPanel className="mt-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Power className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-extrabold text-[#062F24]">Online ordering</h2>
              <p className="mt-1 text-sm text-[#062F24]/65">
                {settings?.onlineOrderingEnabled && !settings.intakePausedAt
                  ? "Customers can place delivery orders."
                  : settings?.intakePausedAt
                    ? "Order intake is paused after missed response deadlines. Resume it from Kitchen Controller."
                  : "Online ordering is off. Customers cannot place delivery orders."}
              </p>
            </div>
          </div>
          <Link
            href="/admin/settings"
            className="inline-flex min-h-11 items-center justify-center rounded-button border border-[#062F24]/15 px-4 text-sm font-semibold text-[#062F24]"
          >
            Review ordering settings
          </Link>
        </div>
      </AdminPanel>

      <Link
        href="/admin/reservations"
        className="mt-6 inline-flex min-h-12 items-center gap-3 rounded-button px-1 text-sm font-semibold text-[#062F24] underline-offset-4 hover:underline"
      >
        <CalendarDays className="h-5 w-5" aria-hidden="true" />
        Open reservations
      </Link>
    </AdminPage>
  );
}
