import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  cancelRun,
  confirmFailedStopReturnedToDesk,
  reassignRun,
  resolveRunException,
  RunOperationError,
} from "@/lib/orders/run-operations";
import { getStaffUser } from "@/lib/supabase/auth";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REASSIGN"),
    driverId: z.string().min(1),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal("CANCEL"),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal("RETURN_TO_DESK"),
    orderId: z.string().min(1),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal("RESOLVE_EXCEPTION"),
    reason: z.string().trim().min(1).max(500),
  }),
]);
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUser("DISPATCH_WRITE");
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    const common = {
      runId: (await params).id,
      reason: parsed.data.reason,
      actor: { id: actor.staff.id, label: actor.staff.displayName },
    };
    const run =
      parsed.data.action === "REASSIGN"
        ? await reassignRun(db, { ...common, driverId: parsed.data.driverId })
        : parsed.data.action === "CANCEL"
          ? await cancelRun(db, common)
          : parsed.data.action === "RETURN_TO_DESK"
            ? await confirmFailedStopReturnedToDesk(db, {
                ...common,
                orderId: parsed.data.orderId,
              })
            : await resolveRunException(db, common);
    return NextResponse.json({ ok: true, data: { run } });
  } catch (error) {
    if (error instanceof RunOperationError)
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    throw error;
  }
}
