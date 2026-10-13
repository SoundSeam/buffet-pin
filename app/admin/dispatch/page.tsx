import { redirect } from "next/navigation";
import { StaffRole } from "@prisma/client";

import { requireStaffUser } from "@/lib/supabase/auth";

export default async function DispatchPage() {
  const { staff } = await requireStaffUser("DISPATCH_WRITE");
  redirect(
    staff.role === StaffRole.DISPATCHER ? "/admin/drivers" : "/admin/orders",
  );
}
