"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, UserRoundCheck } from "lucide-react";

import {
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-page-ui";

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
};

export default function DriverAvailabilityPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetch("/api/admin/drivers", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((body) => setDrivers(body.data.drivers))
      .finally(() => setLoading(false));
  }, []);
  return (
    <AdminPage>
      <AdminPageHeader
        title="Drivers"
        description="Who can deliver right now?"
      />
      {loading ? (
        <p className="mt-8 flex items-center gap-2">
          <Loader2 className="animate-spin" size={18} /> Loading drivers
        </p>
      ) : null}
      {!loading && drivers.length === 0 ? (
        <div className="mt-8">
          <AdminEmptyState>No active drivers are available.</AdminEmptyState>
        </div>
      ) : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {drivers.map((driver) => (
          <AdminPanel key={driver.id}>
            <UserRoundCheck className="h-6 w-6" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-extrabold text-[#062F24]">
              {driver.name}
            </h2>
            <p className="mt-1 text-sm text-[#062F24]/65">
              {driver.isActive
                ? "Available for scheduled dispatch coverage"
                : "Not available"}
            </p>
            {driver.phone ? (
              <a
                className="mt-4 block text-sm font-semibold underline"
                href={`tel:${driver.phone}`}
              >
                {driver.phone}
              </a>
            ) : null}
            <Link
              className="mt-5 inline-flex min-h-11 items-center rounded-button border border-[#062F24]/15 px-4 text-sm font-semibold"
              href={`/admin/drivers/${driver.id}/operations`}
            >
              Shifts and zones
            </Link>
          </AdminPanel>
        ))}
      </div>
    </AdminPage>
  );
}
