import { NextResponse } from "next/server";
import { z } from "zod";

import { getDriverSession } from "@/lib/driver-access";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const driverSession = await getDriverSession();
  if (!driverSession) {
    return errorResponse(401, "UNAUTHORIZED", "Driver access required.");
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid order id.", parsedParams.error.issues);
  }

  void request;
  return errorResponse(409, "RUN_WORKFLOW_REQUIRED", "Legacy per-order driver updates are disabled. Use the assigned delivery run manifest.");
}
