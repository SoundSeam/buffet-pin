import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ControllerOrderError,
  resumeOrderIntake,
} from "@/lib/orders/controller";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.object({ reason: z.string().trim().min(1).max(300) });

export async function POST(request: Request) {
  const actor = await getStaffUser("ORDER_INTAKE_WRITE");
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
  try {
    const settings = await resumeOrderIntake({
      actor: { id: actor.staff.id, label: actor.staff.displayName },
      reason: parsed.data.reason,
    });
    return NextResponse.json({ ok: true, data: { settings } });
  } catch (error) {
    if (error instanceof ControllerOrderError)
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    throw error;
  }
}
