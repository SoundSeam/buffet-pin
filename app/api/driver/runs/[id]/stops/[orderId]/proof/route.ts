import { NextResponse } from "next/server";
import { z } from "zod";

import { getDriverSession } from "@/lib/driver-access";
import {
  DeliveryProofError,
  storeDeliveryProof,
} from "@/lib/orders/delivery-proof";

export const runtime = "nodejs";

const schema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(16).max(7_100_000),
  capturedAt: z.coerce.date(),
});

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
    const proof = await storeDeliveryProof({
      runId: route.id,
      orderId: route.orderId,
      driverId: session.driver.id,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, data: { proof } });
  } catch (error) {
    if (error instanceof DeliveryProofError)
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    throw error;
  }
}
