import { OrderFulfillmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AdminOrderError, updateOrderFulfillmentStatus } from "@/lib/orders/admin";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderFulfillmentStatus),
  prepEstimateMinutes: z.coerce.number().int().min(5).max(180).optional(),
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
    const order = await updateOrderFulfillmentStatus({
      orderId: parsedParams.data.id,
      status: payload.status,
      actorId: user.id,
      actorLabel: user.email ?? "Admin",
      prepEstimateMinutes: payload.prepEstimateMinutes,
    });

    return NextResponse.json({ ok: true, data: { order } });
  } catch (error) {
    if (error instanceof AdminOrderError) {
      return errorResponse(error.status, error.code, error.message);
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update order status.");
  }
}
