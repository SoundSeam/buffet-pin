import { OrderFulfillmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { notifyOrderFulfillmentStatus } from "@/lib/orders/notifications";
import {
  confirmRunHandoff,
  RunOperationError,
} from "@/lib/orders/run-operations";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.object({ bagsConfirmed: z.literal(true) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUser("DISPATCH_WRITE");
  if (!actor)
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: { code: "BAG_CONFIRMATION_REQUIRED" } },
      { status: 400 },
    );
  try {
    const run = await confirmRunHandoff(db, {
      runId: (await params).id,
      actor: { id: actor.staff.id, label: actor.staff.displayName },
    });
    await Promise.all(
      run.stops
        .filter((stop) => stop.status !== "CANCELLED")
        .map((stop) =>
          notifyOrderFulfillmentStatus(
            stop.orderId,
            OrderFulfillmentStatus.ON_THE_WAY,
            { runNumber: run.runNumber, recovery: true },
          ),
        ),
    );
    return NextResponse.json({ ok: true, data: { run } });
  } catch (error) {
    if (error instanceof RunOperationError)
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    throw error;
  }
}
