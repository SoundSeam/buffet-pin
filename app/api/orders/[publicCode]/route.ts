import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  PUBLIC_ORDER_CODE_LENGTH,
  normalizePublicOrderCode,
} from "@/lib/orders/codes";
import { publicOrderSelect, serializePublicOrder } from "@/lib/orders/customer";

export const dynamic = "force-dynamic";

const publicCodeSchema = z.object({
  publicCode: z
    .string()
    .trim()
    .transform(normalizePublicOrderCode)
    .pipe(
      z
        .string()
        .length(PUBLIC_ORDER_CODE_LENGTH)
        .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/),
    ),
});

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicCode: string }> },
) {
  const parsedParams = publicCodeSchema.safeParse(await params);

  if (!parsedParams.success) {
    return errorResponse(
      400,
      "INVALID_ORDER_CODE",
      "A valid order code is required.",
    );
  }

  const order = await db.order.findUnique({
    where: { publicCode: parsedParams.data.publicCode },
    select: publicOrderSelect,
  });

  if (!order) {
    return errorResponse(404, "ORDER_NOT_FOUND", "Order not found.");
  }

  return NextResponse.json({
    ok: true,
    data: {
      order: serializePublicOrder(order),
    },
  });
}
