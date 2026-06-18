import {
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderRefundStatus,
  Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { adminOrderInclude, serializeAdminOrder } from "@/lib/orders/admin";
import { getAdminUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const listOrdersSchema = z.object({
  status: z.nativeEnum(OrderFulfillmentStatus).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function GET(request: Request) {
  const user = await getAdminUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Admin access required.");
  }

  let query: z.infer<typeof listOrdersSchema>;

  try {
    query = listOrdersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid order filters.", error.issues);
    }
    return errorResponse(400, "VALIDATION_ERROR", "Invalid order filters.");
  }

  const where: Prisma.OrderWhereInput = query.status
    ? { fulfillmentStatus: query.status }
    : {
        OR: [
          {
            paymentStatus: {
              in: [
                OrderPaymentStatus.PAID,
                OrderPaymentStatus.REFUNDED,
                OrderPaymentStatus.PARTIALLY_REFUNDED,
              ],
            },
          },
          {
            refundStatus: {
              not: OrderRefundStatus.NOT_REQUIRED,
            },
          },
          {
            fulfillmentStatus: {
              in: [
                OrderFulfillmentStatus.AWAITING_ACCEPTANCE,
                OrderFulfillmentStatus.ACCEPTED,
                OrderFulfillmentStatus.PREPARING,
                OrderFulfillmentStatus.READY_FOR_PICKUP,
                OrderFulfillmentStatus.DRIVER_ASSIGNED,
                OrderFulfillmentStatus.PICKED_UP,
                OrderFulfillmentStatus.ON_THE_WAY,
                OrderFulfillmentStatus.ARRIVING_SOON,
                OrderFulfillmentStatus.DELIVERED,
                OrderFulfillmentStatus.REJECTED,
                OrderFulfillmentStatus.CANCELLED,
              ],
            },
          },
        ],
      };

  const [orders, drivers] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: query.limit,
      include: adminOrderInclude,
    }),
    db.driver.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      orders: orders.map(serializeAdminOrder),
      drivers,
    },
  });
}
