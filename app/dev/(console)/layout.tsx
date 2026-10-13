import type { Metadata } from "next";

import AdminShell from "@/components/admin/admin-shell";
import { PRIVATE_ROBOTS_METADATA } from "@/lib/seo";
import { getStaffRole } from "@/lib/supabase/auth";

export const metadata: Metadata = PRIVATE_ROBOTS_METADATA;
export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staffRole = await getStaffRole();
  return (
    <AdminShell audience="developer" staffRole={staffRole}>
      {children}
    </AdminShell>
  );
}
