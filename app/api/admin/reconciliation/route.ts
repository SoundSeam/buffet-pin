import { NextResponse } from "next/server";
import {
  OperationalAlertSeverity,
  OperationalAlertStatus,
  OrderActorType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  compareReconciliation,
  getLocalReconciliationRows,
  reconciliationDayRange,
} from "@/lib/orders/reconciliation";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const importSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  providerRows: z
    .array(
      z.object({
        providerPaymentId: z.string().min(1),
        providerOrderId: z.string().nullable().optional(),
        amountCents: z.number().int().nonnegative(),
        refundedAmountCents: z.number().int().nonnegative(),
        tipCents: z.number().int().nonnegative(),
        taxCents: z.number().int().nonnegative(),
        deliveryFeeCents: z.number().int().nonnegative(),
        currency: z.string().length(3),
      }),
    )
    .max(10_000),
});

export async function GET(request: Request) {
  if (!(await getStaffUserWithAnyCapability(["REPORTING_READ", "DEV_TOOLS"])))
    return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR" } },
      { status: 400 },
    );
  const { start, end, timezone } = reconciliationDayRange(parsed.data.date);
  const local = await getLocalReconciliationRows(start, end);
  const latestImport = await db.reconciliationImport.findFirst({
    where: { serviceDate: parsed.data.date },
    include: { variances: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    ok: true,
    data: {
      date: parsed.data.date,
      timezone,
      providerDataStatus: latestImport
        ? "IMPORTED_SANITIZED"
        : "MANUAL_IMPORT_REQUIRED",
      latestImport,
      report: latestImport?.report ?? compareReconciliation(local, []),
    },
  });
}

export async function POST(request: Request) {
  const actor = await getStaffUserWithAnyCapability([
    "SETTINGS_WRITE",
    "DEV_TOOLS",
  ]);
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = importSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() },
      },
      { status: 400 },
    );
  const { start, end, timezone } = reconciliationDayRange(parsed.data.date);
  const local = await getLocalReconciliationRows(start, end);
  const report = compareReconciliation(local, parsed.data.providerRows);
  const json = (value: unknown) =>
    JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  const varianceInputs = [
    ...report.rows
      .filter((row) => !row.matched)
      .map((row) => ({
        varianceKey: `local:${row.providerPaymentId}`,
        providerPaymentId: row.providerPaymentId,
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        reasons: row.reasons,
        local: row,
        provider: row.provider,
      })),
    ...report.providerOnly.map((row, index) => ({
      varianceKey: `provider:${row.provider.providerPaymentId}:${index}`,
      providerPaymentId: row.provider.providerPaymentId,
      orderId: null,
      orderNumber: null,
      reasons: row.reasons,
      local: null,
      provider: row.provider,
    })),
  ];
  const imported = await db.$transaction(async (tx) => {
    const created = await tx.reconciliationImport.create({
      data: {
        serviceDate: parsed.data.date,
        timezone,
        source: "SANITIZED_MANUAL_IMPORT",
        importedBy: actor.staff.id,
        importedByLabel: actor.staff.displayName,
        providerRowCount: parsed.data.providerRows.length,
        providerRows: json(parsed.data.providerRows),
        report: json(report),
      },
    });
    await tx.operationalAlert.updateMany({
      where: {
        alertKey: {
          startsWith: `reconciliation-variance:${parsed.data.date}:`,
        },
        status: {
          in: [
            OperationalAlertStatus.OPEN,
            OperationalAlertStatus.ACKNOWLEDGED,
          ],
        },
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNote: "Superseded by a newer reconciliation import.",
      },
    });
    await tx.operationalAlert.updateMany({
      where: { alertKey: `reconciliation-required:${parsed.data.date}` },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNote: "Sanitized Clover report imported.",
      },
    });
    for (const variance of varianceInputs) {
      const alertKey = `reconciliation-variance:${parsed.data.date}:${variance.varianceKey}`;
      await tx.reconciliationVariance.create({
        data: {
          importId: created.id,
          varianceKey: variance.varianceKey,
          alertKey,
          providerPaymentId: variance.providerPaymentId,
          orderId: variance.orderId,
          orderNumber: variance.orderNumber,
          reasons: json(variance.reasons),
          localSnapshot: variance.local ? json(variance.local) : undefined,
          providerSnapshot: variance.provider
            ? json(variance.provider)
            : undefined,
        },
      });
      await tx.operationalAlert.upsert({
        where: { alertKey },
        create: {
          alertKey,
          category: "RECONCILIATION_VARIANCE",
          severity: OperationalAlertSeverity.CRITICAL,
          entityType: "ReconciliationImport",
          entityId: parsed.data.date,
          orderNumber: variance.orderNumber,
          summary: `Clover reconciliation variance: ${variance.reasons.join(", ")}.`,
          details: json({
            importId: created.id,
            providerPaymentId: variance.providerPaymentId,
          }),
        },
        update: {
          status: OperationalAlertStatus.OPEN,
          severity: OperationalAlertSeverity.CRITICAL,
          summary: `Clover reconciliation variance: ${variance.reasons.join(", ")}.`,
          details: json({
            importId: created.id,
            providerPaymentId: variance.providerPaymentId,
          }),
          lastSeenAt: new Date(),
          resolvedAt: null,
          resolutionNote: null,
        },
      });
    }
    await tx.operationalAuditEvent.create({
      data: {
        actorType: OrderActorType.ADMIN,
        actorId: actor.staff.id,
        actorLabel: actor.staff.displayName,
        eventType: "RECONCILIATION_REPORT_IMPORTED",
        entityType: "ReconciliationImport",
        entityId: created.id,
        reason: `Daily Clover report imported for ${parsed.data.date}.`,
        metadata: json(report.summary),
      },
    });
    return tx.reconciliationImport.findUniqueOrThrow({
      where: { id: created.id },
      include: { variances: true },
    });
  });
  return NextResponse.json({
    ok: true,
    data: {
      date: parsed.data.date,
      timezone,
      providerDataStatus: "IMPORTED_SANITIZED",
      import: imported,
      report,
    },
  });
}
