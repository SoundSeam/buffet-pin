import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DeliveryValidationError } from "@/lib/orders/delivery";
import { OrderPricingError, priceCart } from "@/lib/orders/pricing";
import { priceCartSchema } from "@/lib/orders/validation";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    const payload = priceCartSchema.parse(await request.json());
    const pricedCart = await priceCart(payload);

    return NextResponse.json({ ok: true, data: { pricedCart } });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid cart.", error.issues);
    }

    if (error instanceof OrderPricingError) {
      const status =
        error.code === "ITEM_NOT_FOUND"
          ? 404
          : error.code.includes("UNAVAILABLE") ||
              error.code === "PICKUP_DISABLED" ||
              error.code === "DELIVERY_DISABLED"
            ? 409
            : 400;

      return errorResponse(status, error.code, error.message, error.details);
    }

    if (error instanceof DeliveryValidationError) {
      const status =
        error.code === "DELIVERY_OUT_OF_RANGE" || error.code === "DELIVERY_DISABLED"
          ? 409
          : 400;

      return errorResponse(status, error.code, error.message, error.details);
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to price cart.");
  }
}
