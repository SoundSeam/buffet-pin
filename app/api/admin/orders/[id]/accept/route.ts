import { NextResponse } from "next/server";
import { z } from "zod";

import {
  acceptAndStartPreparing,
  ControllerOrderError,
} from "@/lib/orders/controller";
import { getStaffUser } from "@/lib/supabase/auth";

const paramsSchema = z.object({ id: z.string().trim().min(1) });

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUser("ORDER_INTAKE_WRITE");
  if (!actor)
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR" } },
      { status: 400 },
    );
  try {
    const order = await acceptAndStartPreparing({
      orderId: parsed.data.id,
      actor: { id: actor.staff.id, label: actor.staff.displayName },
    });
    return NextResponse.json({ ok: true, data: { order } });
  } catch (error) {
    if (error instanceof ControllerOrderError)
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    throw error;
  }
}
