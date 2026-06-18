import { NextResponse } from "next/server";

import { listDriverOrders } from "@/lib/orders/driver";
import { getDriverUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET() {
  const driverUser = await getDriverUser();
  if (!driverUser) {
    return errorResponse(401, "UNAUTHORIZED", "Driver access required.");
  }

  const orders = await listDriverOrders(driverUser.driver.id);

  return NextResponse.json({
    ok: true,
    data: {
      driver: {
        id: driverUser.driver.id,
        name: driverUser.driver.name,
        email: driverUser.driver.email,
        phone: driverUser.driver.phone,
      },
      orders,
    },
  });
}
