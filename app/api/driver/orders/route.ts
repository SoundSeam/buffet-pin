import { NextResponse } from "next/server";

import { getDriverSession } from "@/lib/driver-access";
import { listDriverOrders } from "@/lib/orders/driver";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET() {
  const driverSession = await getDriverSession();
  if (!driverSession) {
    return errorResponse(401, "UNAUTHORIZED", "Driver access required.");
  }

  const orders = await listDriverOrders(driverSession.driver.id);

  return NextResponse.json({
    ok: true,
    data: {
      driver: {
        id: driverSession.driver.id,
        name: driverSession.driver.name,
        email: driverSession.driver.email,
        phone: driverSession.driver.phone,
      },
      orders,
    },
  });
}
