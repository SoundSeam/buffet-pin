import { NextResponse } from "next/server";
import { z } from "zod";
import {
  abandonFailedCloverOrder,
  resolveCloverOrderNotCreated,
  resolveUnknownCloverOrder,
} from "@/lib/clover/platform-orders";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";
import { db } from "@/lib/db";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("RESOLVE_CREATED"),
    externalOrderId: z.string().min(1),
    providerOrderId: z.string().min(1),
    evidence: z.object({
      verificationMethod: z.literal("CLOVER_API"),
      observedAt: z.string().datetime(),
      note: z.string().trim().min(10).max(500),
    }),
  }),
  z.object({
    action: z.literal("ABANDON_FAILED"),
    externalOrderId: z.string().min(1),
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("RECONCILE_NOT_CREATED"),
    externalOrderId: z.string().min(1),
    evidence: z.object({
      verificationMethod: z.enum(["CLOVER_DASHBOARD", "CLOVER_SUPPORT"]),
      observedAt: z.string().datetime(),
      note: z.string().trim().min(10).max(500),
    }),
  }),
]);

export async function GET() {
  if (!(await getStaffUserWithAnyCapability(["SETTINGS_WRITE", "DEV_TOOLS"])))
    return NextResponse.json({ ok: false }, { status: 403 });
  const externalOrders = await db.externalOrder.findMany({
    where: { state: { in: ["UNKNOWN", "FAILED", "TOTAL_MISMATCH"] } },
    include: { order: { select: { orderNumber: true, paymentStatus: true } } },
    orderBy: { updatedAt: "asc" },
  });
  return NextResponse.json({ ok: true, data: { externalOrders } });
}

export async function POST(request: Request) {
  const actor = await getStaffUserWithAnyCapability([
    "SETTINGS_WRITE",
    "DEV_TOOLS",
  ]);
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    const externalOrder =
      parsed.data.action === "RESOLVE_CREATED"
        ? await resolveUnknownCloverOrder({
            ...parsed.data,
            actorId: actor.staff.id,
          })
        : parsed.data.action === "RECONCILE_NOT_CREATED"
          ? await resolveCloverOrderNotCreated({
              externalOrderId: parsed.data.externalOrderId,
              evidence: parsed.data.evidence,
              actorId: actor.staff.id,
              actorLabel: actor.staff.displayName,
            })
          : await abandonFailedCloverOrder({
              ...parsed.data,
              actorId: actor.staff.id,
              actorLabel: actor.staff.displayName,
            });
    return NextResponse.json({ ok: true, data: { externalOrder } });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "EXTERNAL_ORDER_RECOVERY_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "External order recovery failed.",
        },
      },
      { status: 409 },
    );
  }
}
