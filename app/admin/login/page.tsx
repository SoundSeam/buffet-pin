import { redirect } from "next/navigation";

import SiteShell from "@/components/site-shell";
import AdminLoginForm from "@/components/admin/admin-login-form";
import { getAdminUser } from "@/lib/supabase/auth";

export default async function AdminLoginPage() {
  const user = await getAdminUser();

  if (user) {
    redirect("/admin/reservations");
  }

  return (
    <SiteShell>
      <section className="px-6 pb-20 pt-36 lg:pt-40" style={{ background: "#FFFFFF" }}>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-extrabold leading-none text-[#062F24]">
            Admin login
          </h1>
          <div className="mt-8">
            <AdminLoginForm />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
