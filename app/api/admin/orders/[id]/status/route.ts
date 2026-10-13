import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffUser } from "@/lib/supabase/auth";

const paramsSchema = z.object({ id: z.string().trim().min(1) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getStaffUser("PRODUCTION_WRITE"))) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  if (!paramsSchema.safeParse(await params).success) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR" } }, { status: 400 });
  void request;
  return NextResponse.json({ ok: false, error: { code: "OPERATIONAL_WORKFLOW_REQUIRED", message: "Direct fulfillment updates are disabled. Use production, cancellation/rejection, and delivery-run workflows." } }, { status: 409 });
}
