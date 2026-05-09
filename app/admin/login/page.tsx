import SiteShell from "@/components/site-shell";
import AdminLoginForm from "@/components/admin/admin-login-form";

export default function AdminLoginPage() {
  return (
    <SiteShell>
      <section className="px-6 pb-20 pt-32" style={{ background: "#041F18" }}>
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold text-[#C9A56A]">
            Staff
          </p>
          <h1 className="mt-3 text-5xl font-bold text-[#F4E8D2]">
            Admin login
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#F4E8D2]/70">
            Sign in with Supabase Auth. Access is limited to emails in the admin allowlist.
          </p>
          <div className="mt-10">
            <AdminLoginForm />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
