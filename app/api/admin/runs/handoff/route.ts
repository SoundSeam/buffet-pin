import { OrderFulfillmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { notifyOrderFulfillmentStatus } from "@/lib/orders/notifications";
import { verifyRouteSuggestionEvidence } from "@/lib/orders/route-evidence";
import {
  confirmRunHandoff,
  createOperationalRun,
  RunOperationError,
} from "@/lib/orders/run-operations";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.object({
  requestKey: z.string().trim().min(1).max(200),
  driverId: z.string().trim().min(1),
  orderIds: z.array(z.string().trim().min(1)).min(1).max(4),
  evidenceToken: z.string().trim().min(20).max(5000),
  bagsConfirmed: z.literal(true),
});

export async function POST(request: Request) {
  const actor = await getStaffUser("DISPATCH_WRITE");
  if (!actor)
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR" } },
      { status: 400 },
    );
  const evidence = verifyRouteSuggestionEvidence(parsed.data.evidenceToken, {
    driverId: parsed.data.driverId,
    orderIds: parsed.data.orderIds,
  });
  if (!evidence)
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ROUTE_EVIDENCE_INVALID",
          message: "The recommendation expired or no longer matches these bags.",
        },
      },
      { status: 409 },
    );
  try {
    const run = await createOperationalRun(db, {
      requestKey: parsed.data.requestKey,
      orderIds: parsed.data.orderIds,
      driverId: parsed.data.driverId,
      routePlan: {
        explanation: evidence.explanation,
        routingStatus: evidence.routingStatus,
        durationSeconds: evidence.durationSeconds,
        distanceMeters: evidence.distanceMeters,
      },
      actor: { id: actor.staff.id, label: actor.staff.displayName },
    });
    const dispatched = await confirmRunHandoff(db, {
      runId: run.id,
      actor: { id: actor.staff.id, label: actor.staff.displayName },
    });
    await Promise.all(
      dispatched.stops
        .filter((stop) => stop.status !== "CANCELLED")
        .map((stop) =>
          notifyOrderFulfillmentStatus(
            stop.orderId,
            OrderFulfillmentStatus.ON_THE_WAY,
            { runNumber: dispatched.runNumber },
          ),
        ),
    );
    return NextResponse.json({ ok: true, data: { run: dispatched } });
  } catch (error) {
    if (error instanceof RunOperationError)
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    throw error;
  }
}
