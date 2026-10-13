import { RefundIntentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";

export async function GET() {
  if (!(await getStaffUserWithAnyCapability(["REFUND_WRITE", "DEV_TOOLS"])))
    return NextResponse.json({ ok: false }, { status: 403 });
  const intents = await db.refundIntent.findMany({
    where: {
      status: {
        in: [
          RefundIntentStatus.PENDING,
          RefundIntentStatus.UNKNOWN,
          RefundIntentStatus.FAILED,
          RefundIntentStatus.REQUIRES_REVIEW,
        ],
      },
    },
    include: {
      order: {
        select: { orderNumber: true, paymentStatus: true, refundStatus: true },
      },
      payment: {
        select: {
          providerPaymentId: true,
          amountCents: true,
          refundedAmountCents: true,
        },
      },
    },
    orderBy: { updatedAt: "asc" },
  });
  return NextResponse.json({ ok: true, data: { intents } });
}
