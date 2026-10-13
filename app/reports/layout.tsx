import type { Metadata } from "next";

import AdminShell from "@/components/admin/admin-shell";
import { PRIVATE_ROBOTS_METADATA } from "@/lib/seo";
import { getStaffRole } from "@/lib/supabase/auth";

export const metadata: Metadata = PRIVATE_ROBOTS_METADATA;

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staffRole = await getStaffRole();
  return (
    <AdminShell audience="reports" staffRole={staffRole}>
      {children}
    </AdminShell>
  );
}
