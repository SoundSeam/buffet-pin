import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDriverSession } from "@/lib/driver-access";
import { listDriverRuns } from "@/lib/orders/run-operations";

export async function GET() {
  const session = await getDriverSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const [runs, settings] = await Promise.all([
    listDriverRuns(db, session.driver.id),
    db.restaurantOrderSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  ]);
  return NextResponse.json({ ok: true, data: {
    driver: session.driver,
    runs,
    restaurant: {
      name: "Buffet PIN",
      latitude: settings.restaurantLatitude,
      longitude: settings.restaurantLongitude,
    },
  } });
}
