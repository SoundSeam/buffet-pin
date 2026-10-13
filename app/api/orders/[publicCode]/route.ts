import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicOrderSelect, serializePublicOrder } from "@/lib/orders/customer";
import {
  parseTrackingCredential,
} from "@/lib/orders/tracking-credential";

export const dynamic = "force-dynamic";

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
  const routeParams = await params;
  const credential = parseTrackingCredential(routeParams.publicCode);

  if (!credential) {
    return errorResponse(
      400,
      "INVALID_ORDER_CODE",
      "A valid order code is required.",
    );
  }

  const order = await db.order.findFirst({
    where: {
      ...(credential.kind === "token"
        ? { trackingToken: credential.value }
        : {
            publicCode: credential.value,
            legacyPublicTrackingEnabled: true,
          }),
    },
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
