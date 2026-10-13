import { NextResponse } from "next/server";
import { z } from "zod";

import {
  addPreparationTime,
  ControllerOrderError,
  markReadyForDelivery,
} from "@/lib/orders/controller";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_time"),
    minutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
    reason: z.string().trim().min(1).max(300),
    requestKey: z.string().trim().min(1).max(200),
  }),
  z.object({
    action: z.literal("ready"),
    orderNumberConfirmed: z.literal(true),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staffActor = await getStaffUser("PRODUCTION_WRITE");
  if (!staffActor)
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "CONTROLLER_WORKFLOW_REQUIRED",
          message: "Use Add time or Ready for delivery from Kitchen Controller.",
        },
      },
      { status: 400 },
    );
  const { id: orderId } = await params;
  const actor = {
    id: staffActor.staff.id,
    label: staffActor.staff.displayName,
  };
  try {
    const result =
      parsed.data.action === "add_time"
        ? await addPreparationTime({
            orderId,
            minutes: parsed.data.minutes,
            reason: parsed.data.reason,
            requestKey: parsed.data.requestKey,
            actor,
          })
        : await markReadyForDelivery({
            orderId,
            orderNumberConfirmed: true,
            actor,
          });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof ControllerOrderError)
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    throw error;
  }
}
