import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildCatalogSyncReport } from "@/lib/orders/catalog";
import { getStaffUser } from "@/lib/supabase/auth";

export async function GET() {
  if (!(await getStaffUser("DEV_TOOLS")))
    return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const [
      catalog,
      externalOrder,
      printJob,
      webhook,
      notification,
      openAlerts,
      variances,
    ] = await Promise.all([
      buildCatalogSyncReport(),
      db.externalOrder.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { state: true, updatedAt: true },
      }),
      db.printJob.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { status: true, updatedAt: true },
      }),
      db.paymentWebhookEvent.findFirst({
        orderBy: { createdAt: "desc" },
        select: { processedAt: true, createdAt: true },
      }),
      db.notification.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { status: true, updatedAt: true },
      }),
      db.operationalAlert.groupBy({
        by: ["category"],
        where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        _count: true,
      }),
      db.reconciliationVariance.count({
        where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      }),
    ]);
    const count = (categories: string[]) =>
      openAlerts
        .filter((row) => categories.includes(row.category))
        .reduce((sum, row) => sum + row._count, 0);
    const checks = [
      {
        key: "application",
        label: "Application health",
        state: "confirmed",
        detail: "The database-backed technical health query completed.",
        observedAt: new Date().toISOString(),
      },
      {
        key: "clover",
        label: "Clover connectivity",
        state:
          count(["PAYMENT_UNKNOWN", "CLOVER_ORDER_UNKNOWN"]) > 0
            ? "attention"
            : externalOrder
              ? "confirmed"
              : "unknown",
        detail: externalOrder
          ? `Latest Clover order evidence is ${externalOrder.state.toLowerCase().replaceAll("_", " ")}.`
          : "No Clover order evidence is available yet.",
        observedAt: externalOrder?.updatedAt.toISOString() ?? null,
      },
      {
        key: "printer",
        label: "Printer and print events",
        state:
          count(["PAID_UNPRINTED", "PRINT_FAILED", "PRINT_UNKNOWN"]) > 0
            ? "attention"
            : printJob?.status === "PRINTED"
              ? "confirmed"
              : "unknown",
        detail: printJob
          ? `Latest print evidence is ${printJob.status.toLowerCase()}.`
          : "No print-event evidence is available yet.",
        observedAt: printJob?.updatedAt.toISOString() ?? null,
      },
      {
        key: "webhook",
        label: "Webhook health",
        state: webhook?.processedAt
          ? "confirmed"
          : webhook
            ? "attention"
            : "unknown",
        detail: webhook?.processedAt
          ? "The latest payment webhook was processed."
          : webhook
            ? "The latest payment webhook is not marked processed."
            : "No webhook evidence is available yet.",
        observedAt:
          (webhook?.processedAt ?? webhook?.createdAt)?.toISOString() ?? null,
      },
      {
        key: "twilio",
        label: "Customer messages",
        state:
          count(["NOTIFICATION_FAILED"]) > 0
            ? "attention"
            : notification?.status === "SENT"
              ? "confirmed"
              : "unknown",
        detail: notification
          ? `Latest message evidence is ${notification.status.toLowerCase()}.`
          : "No message-delivery evidence is available yet.",
        observedAt: notification?.updatedAt.toISOString() ?? null,
      },
      {
        key: "catalog",
        label: "Catalog readiness",
        state: catalog.ready ? "confirmed" : "attention",
        detail: catalog.ready
          ? "Every required delivery-menu connection passed its latest check."
          : `${catalog.blockers.length} menu connection(s) must be fixed.`,
        observedAt: catalog.checkedAt.toISOString(),
      },
      {
        key: "reconciliation",
        label: "Money comparison",
        state: variances > 0 ? "attention" : "unknown",
        detail:
          variances > 0
            ? `${variances} unresolved financial difference(s) remain.`
            : "No unresolved difference is open; a current closing comparison is still required for a confirmed status.",
        observedAt: null,
      },
    ];
    return NextResponse.json(
      { ok: true, data: { checks } },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "HEALTH_EVIDENCE_UNAVAILABLE" } },
      { status: 503 },
    );
  }
}
