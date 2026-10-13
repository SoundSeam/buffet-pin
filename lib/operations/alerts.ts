import "server-only";

import {
  CatalogMappingStatus,
  DeliveryRunStatus,
  NotificationStatus,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  OrderDispatchStatus,
  OrderActorType,
  OrderPaymentStatus,
  OrderProductionStatus,
  PrintJobPurpose,
  PrintJobStatus,
  RefundIntentStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { reconciliationDayRange } from "@/lib/orders/reconciliation";
import { purgeExpiredDeliveryProofs } from "@/lib/orders/delivery-proof";

export type AlertCandidate = {
  alertKey: string;
  category: string;
  severity: OperationalAlertSeverity;
  entityType?: string;
  entityId?: string;
  orderNumber?: string;
  summary: string;
  details?: Prisma.InputJsonValue;
};

export async function collectOperationalAlertCandidates(now = new Date()): Promise<AlertCandidate[]> {
  const printCutoff = new Date(now.getTime() - 2 * 60_000);
  const paymentCutoff = new Date(now.getTime() - 15 * 60_000);
  const productionCutoff = new Date(now.getTime() - 45 * 60_000);
  const staleSubmissionCutoff = new Date(now.getTime() - 5 * 60_000);
  const localParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((part) => [part.type, part.value]));
  const year = Number(localParts.year); const month = Number(localParts.month); const day = Number(localParts.day);
  const previousServiceDate = new Date(Date.UTC(year!, month! - 1, day! - 1)).toISOString().slice(0, 10);
  const previousServiceRange = reconciliationDayRange(previousServiceDate);
  const [staleRefunds, stalePrints, staleNotifications, staleExternalOrders] = await Promise.all([
    db.refundIntent.findMany({ where: { status: RefundIntentStatus.SUBMITTING, lastAttemptAt: { lte: staleSubmissionCutoff } }, select: { id: true, orderId: true } }),
    db.printJob.findMany({ where: { status: PrintJobStatus.SUBMITTING, updatedAt: { lte: staleSubmissionCutoff } }, select: { id: true, orderId: true } }),
    db.notification.findMany({ where: { status: NotificationStatus.SUBMITTING, lastAttemptAt: { lte: staleSubmissionCutoff } }, select: { id: true, orderId: true } }),
    db.externalOrder.findMany({ where: { state: "PENDING", OR: [{ submissionStartedAt: { lte: staleSubmissionCutoff } }, { submissionToken: null, updatedAt: { lte: staleSubmissionCutoff } }] }, select: { id: true, orderId: true } }),
  ]);
  await db.$transaction(async (tx) => {
    for (const intent of staleRefunds) {
      const changed = await tx.refundIntent.updateMany({ where: { id: intent.id, status: RefundIntentStatus.SUBMITTING }, data: { status: RefundIntentStatus.UNKNOWN, lastErrorCode: "SUBMISSION_CRASH_UNKNOWN", lastErrorMessage: "Submission claim expired before a provider outcome was recorded." } });
      if (changed.count === 1) await tx.orderEvent.create({ data: { orderId: intent.orderId, actorType: OrderActorType.SYSTEM, actorLabel: "Operational scanner", eventType: "REFUND_SUBMISSION_LEASE_EXPIRED_UNKNOWN", metadata: { refundIntentId: intent.id } } });
    }
    for (const job of stalePrints) {
      const changed = await tx.printJob.updateMany({ where: { id: job.id, status: PrintJobStatus.SUBMITTING }, data: { status: PrintJobStatus.UNKNOWN, lastErrorCode: "SUBMISSION_CRASH_UNKNOWN", lastErrorMessage: "Submission claim expired before a provider outcome was recorded." } });
      if (changed.count === 1) await tx.orderEvent.create({ data: { orderId: job.orderId, actorType: OrderActorType.SYSTEM, actorLabel: "Operational scanner", eventType: "KITCHEN_PRINT_SUBMISSION_LEASE_EXPIRED_UNKNOWN", metadata: { printJobId: job.id } } });
    }
    for (const notification of staleNotifications) {
      const changed = await tx.notification.updateMany({ where: { id: notification.id, status: NotificationStatus.SUBMITTING }, data: { status: NotificationStatus.UNKNOWN, errorMessage: "Submission claim expired before a provider outcome was recorded." } });
      if (changed.count === 1) await tx.operationalAuditEvent.create({ data: { actorType: OrderActorType.SYSTEM, actorLabel: "Operational scanner", eventType: "NOTIFICATION_SUBMISSION_LEASE_EXPIRED_UNKNOWN", entityType: "Notification", entityId: notification.id, metadata: notification.orderId ? { orderId: notification.orderId } : undefined } });
    }
    for (const externalOrder of staleExternalOrders) {
      const changed = await tx.externalOrder.updateMany({ where: { id: externalOrder.id, state: "PENDING", OR: [{ submissionStartedAt: { lte: staleSubmissionCutoff } }, { submissionToken: null, updatedAt: { lte: staleSubmissionCutoff } }] }, data: { state: "UNKNOWN", submissionToken: null } });
      if (changed.count === 1) await tx.orderEvent.create({ data: { orderId: externalOrder.orderId, actorType: OrderActorType.SYSTEM, actorLabel: "Operational scanner", eventType: "CLOVER_ORDER_SUBMISSION_LEASE_EXPIRED_UNKNOWN", metadata: { externalOrderId: externalOrder.id } } });
    }
  });
  const [paidUnprinted, pendingPayments, externalOrders, unknownRefunds, stuckProduction, lateOrders, failedNotifications, catalogMappings, routeExceptions, priorDayPayments, priorDayImports] = await Promise.all([
    db.order.findMany({ where: { paymentStatus: { in: [OrderPaymentStatus.PAID, OrderPaymentStatus.PARTIALLY_REFUNDED] }, createdAt: { lte: printCutoff }, productionStatus: { notIn: [OrderProductionStatus.REJECTED, OrderProductionStatus.CANCELLED] }, printJobs: { none: { purpose: { in: [PrintJobPurpose.INITIAL, PrintJobPurpose.FALLBACK] }, status: PrintJobStatus.PRINTED } } }, select: { id: true, orderNumber: true, createdAt: true } }),
    db.payment.findMany({ where: { status: OrderPaymentStatus.PENDING, createdAt: { lte: paymentCutoff }, OR: [{ providerPaymentId: { not: null } }, { checkoutSessionId: { not: null } }] }, select: { id: true, order: { select: { orderNumber: true } } } }),
    db.externalOrder.findMany({ where: { state: { in: ["UNKNOWN", "FAILED", "TOTAL_MISMATCH"] } }, select: { id: true, state: true, order: { select: { orderNumber: true } } } }),
    db.refundIntent.findMany({ where: { OR: [{ status: { in: [RefundIntentStatus.UNKNOWN, RefundIntentStatus.FAILED, RefundIntentStatus.REQUIRES_REVIEW] } }, { status: RefundIntentStatus.PENDING, createdAt: { lte: printCutoff } }] }, select: { id: true, order: { select: { orderNumber: true } }, lastErrorCode: true } }),
    db.order.findMany({ where: { paymentStatus: OrderPaymentStatus.PAID, productionStatus: { notIn: [OrderProductionStatus.AT_DISPATCH_DESK, OrderProductionStatus.REJECTED, OrderProductionStatus.CANCELLED] }, updatedAt: { lte: productionCutoff } }, select: { id: true, orderNumber: true, productionStatus: true } }),
    db.order.findMany({ where: { paymentStatus: OrderPaymentStatus.PAID, promisedDeliveryEndAt: { lt: now }, dispatchStatus: { notIn: [OrderDispatchStatus.DELIVERED, OrderDispatchStatus.CANCELLED] } }, select: { id: true, orderNumber: true, dispatchStatus: true, promisedDeliveryEndAt: true } }),
    db.notification.findMany({ where: { OR: [{ status: { in: [NotificationStatus.FAILED, NotificationStatus.UNKNOWN] } }, { status: NotificationStatus.PENDING, createdAt: { lte: staleSubmissionCutoff } }] }, select: { id: true, order: { select: { orderNumber: true } }, templateKey: true, status: true } }),
    db.providerCatalogMapping.findMany({ where: { status: { not: CatalogMappingStatus.VERIFIED } }, select: { id: true, entityType: true, localKey: true, status: true } }),
    db.deliveryRun.findMany({ where: { status: DeliveryRunStatus.EXCEPTION }, select: { id: true, runNumber: true } }),
    db.payment.count({ where: { paidAt: { gte: previousServiceRange.start, lt: previousServiceRange.end } } }),
    db.reconciliationImport.count({ where: { serviceDate: previousServiceDate } }),
  ]);

  return [
    ...paidUnprinted.map((row) => ({ alertKey: `paid-unprinted:${row.id}`, category: "PAID_UNPRINTED", severity: OperationalAlertSeverity.CRITICAL, entityType: "Order", entityId: row.id, orderNumber: row.orderNumber, summary: "Paid order has no confirmed kitchen ticket (Clover initial or authorized browser fallback)." })),
    ...pendingPayments.map((row) => ({ alertKey: `payment-unknown:${row.id}`, category: "PAYMENT_UNKNOWN", severity: OperationalAlertSeverity.CRITICAL, entityType: "Payment", entityId: row.id, orderNumber: row.order.orderNumber, summary: "Payment outcome remains unresolved." })),
    ...externalOrders.map((row) => ({ alertKey: `external-order:${row.id}`, category: "EXTERNAL_ORDER_EXCEPTION", severity: OperationalAlertSeverity.CRITICAL, entityType: "ExternalOrder", entityId: row.id, orderNumber: row.order.orderNumber, summary: `Clover order creation requires recovery (${row.state}).` })),
    ...unknownRefunds.map((row) => ({ alertKey: `refund-unknown:${row.id}`, category: "REFUND_UNKNOWN", severity: OperationalAlertSeverity.CRITICAL, entityType: "RefundIntent", entityId: row.id, orderNumber: row.order.orderNumber, summary: "Refund outcome requires reconciliation.", details: { errorCode: row.lastErrorCode } })),
    ...stuckProduction.map((row) => ({ alertKey: `stuck-production:${row.id}`, category: "STUCK_PRODUCTION", severity: OperationalAlertSeverity.WARNING, entityType: "Order", entityId: row.id, orderNumber: row.orderNumber, summary: `Order is stuck in ${row.productionStatus}.` })),
    ...lateOrders.map((row) => ({ alertKey: `late-delivery:${row.id}`, category: "LATE_DELIVERY", severity: OperationalAlertSeverity.CRITICAL, entityType: "Order", entityId: row.id, orderNumber: row.orderNumber, summary: `Delivery promise passed in ${row.dispatchStatus}.` })),
    ...failedNotifications.map((row) => ({ alertKey: `notification-failed:${row.id}`, category: "NOTIFICATION_FAILED", severity: OperationalAlertSeverity.WARNING, entityType: "Notification", entityId: row.id, orderNumber: row.order?.orderNumber, summary: `Customer notification requires recovery (${row.templateKey}, ${row.status}).` })),
    ...catalogMappings.map((row) => ({ alertKey: `catalog-mismatch:${row.id}`, category: "CATALOG_MISMATCH", severity: OperationalAlertSeverity.CRITICAL, entityType: "ProviderCatalogMapping", entityId: row.id, summary: `Required ${row.entityType} mapping is ${row.status}.`, details: { localKey: row.localKey } })),
    ...routeExceptions.map((row) => ({ alertKey: `route-exception:${row.id}`, category: "ROUTE_EXCEPTION", severity: OperationalAlertSeverity.WARNING, entityType: "DeliveryRun", entityId: row.id, summary: `Delivery run ${row.runNumber} is in exception.` })),
    ...(priorDayPayments > 0 && priorDayImports === 0 ? [{ alertKey: `reconciliation-required:${previousServiceDate}`, category: "RECONCILIATION_REQUIRED", severity: OperationalAlertSeverity.CRITICAL, entityType: "DailyClose", entityId: previousServiceDate, summary: "Prior service-day payments require provider reconciliation." }] : []),
  ];
}

export async function scanOperationalAlerts(now = new Date()) {
  await purgeExpiredDeliveryProofs(now);
  const candidates = await collectOperationalAlertCandidates(now);
  await db.$transaction(async (tx) => {
    for (const candidate of candidates) {
      await tx.operationalAlert.upsert({
        where: { alertKey: candidate.alertKey },
        create: { ...candidate, lastSeenAt: now },
        update: { category: candidate.category, severity: candidate.severity, status: OperationalAlertStatus.OPEN, summary: candidate.summary, details: candidate.details, orderNumber: candidate.orderNumber, lastSeenAt: now, resolvedAt: null, resolutionNote: null },
      });
    }
    const activeKeys = candidates.map((candidate) => candidate.alertKey);
    await tx.operationalAlert.updateMany({
      where: { status: { in: [OperationalAlertStatus.OPEN, OperationalAlertStatus.ACKNOWLEDGED] }, category: { notIn: ["RECONCILIATION_REQUIRED", "RECONCILIATION_VARIANCE", "DUPLICATE_TICKET_RISK"] }, ...(activeKeys.length ? { alertKey: { notIn: activeKeys } } : {}) },
      data: { status: OperationalAlertStatus.RESOLVED, resolvedAt: now, resolutionNote: "Source condition cleared by scanner." },
    });
  });
  return { scannedAt: now, candidateCount: candidates.length, candidates };
}
