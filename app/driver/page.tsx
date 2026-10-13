import { redirect } from "next/navigation";

import SiteShell from "@/components/site-shell";
import { getDriverSession } from "@/lib/driver-access";

export default async function DriverPage() {
  const driverSession = await getDriverSession();

  if (driverSession) {
    redirect("/driver/runs");
  }

  return (
    <SiteShell>
      <section className="pb-20 pt-36 lg:pt-40" style={{ background: "#FFFFFF" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold leading-none text-[#062F24]">
              Driver access
            </h1>
          </div>
          <div className="mt-8 max-w-2xl rounded-surface border border-[#062F24]/10 bg-white p-6 text-[#062F24] shadow-sm sm:p-8">
            <p className="text-lg font-bold">Open the driver link sent by Buffet Pin.</p>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-[#062F24]/65">
              Ask staff to resend your private link if this device does not already have access.
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
