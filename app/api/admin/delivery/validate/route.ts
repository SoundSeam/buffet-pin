import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DeliveryValidationError, validateDelivery } from "@/lib/orders/delivery";
import { deliveryValidationSchema } from "@/lib/orders/validation";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

async function requireAdminResponse() {
  const user = await getAdminUser();
  return user ? null : errorResponse(401, "UNAUTHORIZED", "Admin access required.");
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  try {
    const payload = deliveryValidationSchema.parse(await request.json());
    const delivery = await validateDelivery(payload);

    return NextResponse.json({ ok: true, data: { delivery } });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid delivery validation request.",
        error.issues,
      );
    }

    if (error instanceof DeliveryValidationError) {
      const status =
        error.code === "DELIVERY_OUT_OF_RANGE"
          ? 409
          : error.code === "DELIVERY_DISABLED"
            ? 409
            : 400;

      return errorResponse(status, error.code, error.message, error.details);
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to validate delivery.");
  }
}
