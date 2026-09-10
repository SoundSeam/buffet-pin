import { NextResponse } from "next/server";
import { getOnlineReservationsEnabled } from "@/lib/reservations/availability";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { onlineReservationsEnabled: await getOnlineReservationsEnabled() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
