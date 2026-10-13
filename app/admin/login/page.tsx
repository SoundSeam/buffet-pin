import { redirect } from "next/navigation";

import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page-ui";
import AdminLoginForm from "@/components/admin/admin-login-form";
import { getStaffRole } from "@/lib/supabase/auth";

export default async function AdminLoginPage() {
  const staffRole = await getStaffRole();

  if (staffRole) {
    redirect("/admin");
  }

  return (
    <AdminPage>
      <AdminPageHeader title="Admin login" />
      <div className="mt-8 max-w-2xl">
        <AdminLoginForm />
      </div>
    </AdminPage>
  );
}
