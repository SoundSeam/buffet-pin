import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/supabase/auth";

export async function GET() {
  if (!(await getStaffUser("ORDERS_READ")))
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  const runs = await db.deliveryRun.findMany({
    include: {
      driver: true,
      stops: {
        orderBy: { position: "asc" },
        include: {
          order: {
            select: {
              orderNumber: true,
              productionStatus: true,
              dispatchStatus: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ ok: true, data: { runs } });
}

export async function POST() {
  if (!(await getStaffUser("DISPATCH_WRITE")))
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "PHYSICAL_HANDOFF_WORKFLOW_REQUIRED",
        message:
          "Runs are created and dispatched only through the Kitchen Controller physical-handoff action.",
      },
    },
    { status: 409 },
  );
}
