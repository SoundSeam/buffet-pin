import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staffActor = await getStaffUser("DISPATCH_WRITE");
  if (!staffActor) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid order id.",
      parsedParams.error.issues,
    );
  }

  void request;
  return errorResponse(
    409,
    "RUN_ASSIGNMENT_REQUIRED",
    "Direct order assignment is disabled. Create an approved delivery run with desk-ready bags.",
  );
}
