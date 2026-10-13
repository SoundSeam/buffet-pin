import { PrintJobStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  observePrintJob,
  retryFailedPrintJob,
  submitPrintJob,
} from "@/lib/clover/print-orders";
import { db } from "@/lib/db";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getStaffUserWithAnyCapability(["PRINT_WRITE", "DEV_TOOLS"])))
    return NextResponse.json({ ok: false }, { status: 401 });
  const jobs = await db.printJob.findMany({
    where: {
      status: {
        in: [
          PrintJobStatus.PENDING,
          PrintJobStatus.SUBMITTING,
          PrintJobStatus.SUBMITTED,
          PrintJobStatus.PRINTING,
          PrintJobStatus.FAILED,
          PrintJobStatus.UNKNOWN,
        ],
      },
    },
    include: { order: { select: { orderNumber: true, paymentStatus: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ ok: true, data: { jobs } });
}

export async function POST(request: Request) {
  const actor = await getStaffUserWithAnyCapability([
    "PRINT_WRITE",
    "DEV_TOOLS",
  ]);
  if (!actor) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await request.json()) as {
    jobId?: string;
    action?: string;
    reason?: string;
  };
  if (
    !body.jobId ||
    !["submit", "observe", "retry_failed"].includes(body.action ?? "") ||
    (body.action === "retry_failed" && !body.reason?.trim())
  ) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_REQUEST" } },
      { status: 400 },
    );
  }
  const job =
    body.action === "submit"
      ? await submitPrintJob(body.jobId)
      : body.action === "observe"
        ? await observePrintJob(body.jobId)
        : await retryFailedPrintJob({
            jobId: body.jobId,
            actorId: actor.staff.id,
            actorLabel: actor.staff.displayName,
            reason: body.reason!,
          });
  return NextResponse.json({ ok: true, data: { job } });
}
