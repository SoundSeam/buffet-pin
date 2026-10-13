import { NextResponse } from "next/server";

import { getDriverSession } from "@/lib/driver-access";

export async function POST() {
  if (!(await getDriverSession()))
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "RESTAURANT_HANDOFF_REQUIRED",
        message:
          "The Kitchen Controller dispatches the run at physical handoff; the driver does not claim pickup separately.",
      },
    },
    { status: 409 },
  );
}
