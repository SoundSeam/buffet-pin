import { NextResponse } from "next/server";

import { getControllerDispatchRecommendations } from "@/lib/orders/dispatch-recommendations";
import { getStaffUser } from "@/lib/supabase/auth";

export async function GET() {
  if (!(await getStaffUser("DISPATCH_WRITE")))
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  const data = await getControllerDispatchRecommendations();
  return NextResponse.json({ ok: true, data });
}
