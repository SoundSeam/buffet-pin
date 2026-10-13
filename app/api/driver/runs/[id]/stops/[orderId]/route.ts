import { OrderFulfillmentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDriverSession } from "@/lib/driver-access";
import {
  DeliveryProofError,
  failCurrentDelivery,
  finalizeDeliveryWithProof,
  markDeliveryArrived,
} from "@/lib/orders/delivery-proof";
import { notifyOrderFulfillmentStatus } from "@/lib/orders/notifications";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ARRIVED") }),
  z.object({ action: z.literal("FINALIZE") }),
  z.object({
    action: z.literal("FAILED"),
    reason: z.string().trim().min(1).max(500),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  const session = await getDriverSession();
  if (!session)
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR" } },
      { status: 400 },
    );
  const route = await params;
  try {
    const common = {
      runId: route.id,
      orderId: route.orderId,
      driverId: session.driver.id,
    };
    const result =
      parsed.data.action === "ARRIVED"
        ? await markDeliveryArrived(common)
        : parsed.data.action === "FINALIZE"
          ? await finalizeDeliveryWithProof(common)
          : await failCurrentDelivery({ ...common, reason: parsed.data.reason });
    if (parsed.data.action === "FINALIZE")
      await notifyOrderFulfillmentStatus(
        route.orderId,
        OrderFulfillmentStatus.DELIVERED,
        { runId: route.id, proofRequired: true },
      );
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof DeliveryProofError)
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    throw error;
  }
}
