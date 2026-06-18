import { redirect } from "next/navigation";

import DriverLoginForm from "@/components/driver/driver-login-form";
import SiteShell from "@/components/site-shell";
import { getDriverUser } from "@/lib/supabase/auth";

export default async function DriverPage() {
  const driverUser = await getDriverUser();

  if (driverUser) {
    redirect("/driver/orders");
  }

  return (
    <SiteShell>
      <section className="px-6 pb-20 pt-36 lg:pt-40" style={{ background: "#FFFFFF" }}>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-extrabold leading-none text-[#062F24]">
            Driver login
          </h1>
          <div className="mt-8">
            <DriverLoginForm />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
