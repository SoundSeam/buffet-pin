import { DriverAssignmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { DriverOrderError, updateDriverOrderStatus } from "@/lib/orders/driver";
import { getDriverUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

const updateStatusSchema = z.object({
  status: z.enum([
    DriverAssignmentStatus.PICKED_UP,
    DriverAssignmentStatus.ON_THE_WAY,
    DriverAssignmentStatus.ARRIVING_SOON,
    DriverAssignmentStatus.DELIVERED,
  ]),
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
  const driverUser = await getDriverUser();
  if (!driverUser) {
    return errorResponse(401, "UNAUTHORIZED", "Driver access required.");
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid order id.", parsedParams.error.issues);
  }

  let payload: z.infer<typeof updateStatusSchema>;

  try {
    payload = updateStatusSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid status update.", error.issues);
    }
    return errorResponse(400, "INVALID_JSON", "Invalid status update.");
  }

  try {
    const order = await updateDriverOrderStatus({
      orderId: parsedParams.data.id,
      driverId: driverUser.driver.id,
      status: payload.status,
      actorId: driverUser.user.id,
      actorLabel: driverUser.driver.name,
    });

    return NextResponse.json({ ok: true, data: { order } });
  } catch (error) {
    if (error instanceof DriverOrderError) {
      return errorResponse(error.status, error.code, error.message);
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update delivery status.");
  }
}
