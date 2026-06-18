import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AdminOrderError, assignOrderDriver } from "@/lib/orders/admin";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

const assignDriverSchema = z.object({
  driverId: z.string().trim().min(1),
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
  const user = await getAdminUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid order id.", parsedParams.error.issues);
  }

  let payload: z.infer<typeof assignDriverSchema>;

  try {
    payload = assignDriverSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid driver assignment.", error.issues);
    }
    return errorResponse(400, "INVALID_JSON", "Invalid driver assignment.");
  }

  try {
    const order = await assignOrderDriver({
      orderId: parsedParams.data.id,
      driverId: payload.driverId,
      actorId: user.id,
      actorLabel: user.email ?? "Admin",
    });

    return NextResponse.json({ ok: true, data: { order } });
  } catch (error) {
    if (error instanceof AdminOrderError) {
      return errorResponse(error.status, error.code, error.message);
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to assign driver.");
  }
}
