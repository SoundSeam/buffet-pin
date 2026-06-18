import { NextResponse } from "next/server";
import { z } from "zod";

import { getDriverOrder } from "@/lib/orders/driver";
import { getDriverUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const driverUser = await getDriverUser();
  if (!driverUser) {
    return errorResponse(401, "UNAUTHORIZED", "Driver access required.");
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid order id.", parsedParams.error.issues);
  }

  const order = await getDriverOrder(driverUser.driver.id, parsedParams.data.id);
  if (!order) {
    return errorResponse(404, "ORDER_NOT_FOUND", "Assigned order not found.");
  }

  return NextResponse.json({ ok: true, data: { order } });
}
