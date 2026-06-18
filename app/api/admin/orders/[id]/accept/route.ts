import { OrderFulfillmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AdminOrderError, updateOrderFulfillmentStatus } from "@/lib/orders/admin";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

const acceptOrderSchema = z.object({
  prepEstimateMinutes: z.coerce.number().int().min(5).max(180).optional(),
});

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function POST(
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

  let payload: z.infer<typeof acceptOrderSchema>;

  try {
    payload = acceptOrderSchema.parse(await request.json().catch(() => ({})));
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid accept request.", error.issues);
    }
    return errorResponse(400, "INVALID_JSON", "Invalid accept request.");
  }

  try {
    const order = await updateOrderFulfillmentStatus({
      orderId: parsedParams.data.id,
      status: OrderFulfillmentStatus.ACCEPTED,
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
    return errorResponse(500, "INTERNAL_ERROR", "Unable to accept order.");
  }
}
