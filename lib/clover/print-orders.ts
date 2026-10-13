import { OrderActorType, OrderPaymentStatus, Prisma, PrintJobPurpose, PrintJobStatus } from "@prisma/client";
import { CloverApiError, createCloverClient, type CloverClient } from "@/lib/clover/client";
import { db } from "@/lib/db";

type PrintEvent = { id?: string; state?: string; orderRef?: { id?: string }; [key: string]: unknown };

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function classifyPrintSubmissionError(error: unknown) {
  return error instanceof CloverApiError && error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status)
    ? PrintJobStatus.FAILED
    : PrintJobStatus.UNKNOWN;
}

export async function submitPrintJob(jobId: string, client: CloverClient = createCloverClient()) {
  const job = await db.printJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { order: { include: { externalOrders: true } } },
  });
  if (job.order.paymentStatus !== OrderPaymentStatus.PAID) throw new Error("Unpaid orders cannot print.");
  if (job.purpose !== PrintJobPurpose.INITIAL) throw new Error("Only the durable initial print intent can be submitted to Clover. Reprints and browser fallbacks require labelled, physical confirmation.");
  if (job.status !== PrintJobStatus.PENDING) return job;
  const external = job.order.externalOrders.find((value) => value.provider === "CLOVER");
  if (!external?.providerOrderId || external.state !== "CREATED") {
    throw new Error("A reconciled Clover order is required before printing.");
  }
  const claimed = await db.$transaction(async (tx) => {
    const changed = await tx.printJob.updateMany({
      where: { id: job.id, status: PrintJobStatus.PENDING },
      data: { status: PrintJobStatus.SUBMITTING, attempts: { increment: 1 } },
    });
    if (changed.count === 1) await tx.orderEvent.create({
      data: { orderId: job.orderId, actorType: job.requestedByActorType, actorId: job.requestedByActorId, actorLabel: job.requestedByLabel, eventType: "KITCHEN_PRINT_SUBMISSION_STARTED", metadata: { printJobId: job.id, purpose: job.purpose } },
    });
    return changed.count;
  });
  if (claimed !== 1) return db.printJob.findUniqueOrThrow({ where: { id: job.id } });
  const request = { orderRef: { id: external.providerOrderId } };
  try {
    const response = await client.post<PrintEvent>(
      `/v3/merchants/${encodeURIComponent(client.config.merchantId)}/print_event`,
      request,
      { headers: { "User-Agent": "BuffetPinDirect/1.0" } },
    );
    if (!response.id) throw new CloverApiError("Clover print response omitted event id.", 502, response);
    return db.$transaction(async (tx) => {
      const changed = await tx.printJob.updateMany({
        where: { id: job.id, status: PrintJobStatus.SUBMITTING },
        data: {
        status: PrintJobStatus.SUBMITTED,
        providerPrintEventId: response.id,
        submittedAt: new Date(),
        sanitizedRequest: json(request),
        sanitizedObservation: json(response),
        },
      });
      if (changed.count === 1) await tx.orderEvent.create({ data: { orderId: job.orderId, actorType: job.requestedByActorType, actorId: job.requestedByActorId, actorLabel: job.requestedByLabel, eventType: "KITCHEN_PRINT_SUBMITTED", metadata: { printJobId: job.id, providerPrintEventId: response.id } } });
      else await tx.orderEvent.create({ data: { orderId: job.orderId, actorType: OrderActorType.SYSTEM, actorLabel: "Clover print submitter", eventType: "KITCHEN_PRINT_LATE_SUBMISSION_RESULT_IGNORED", metadata: { printJobId: job.id, providerPrintEventId: response.id, outcome: "SUBMITTED" } } });
      return tx.printJob.findUniqueOrThrow({ where: { id: job.id } });
    });
  } catch (error) {
    const status = classifyPrintSubmissionError(error);
    return db.$transaction(async (tx) => {
      const changed = await tx.printJob.updateMany({
        where: { id: job.id, status: PrintJobStatus.SUBMITTING },
        data: {
        status,
        lastErrorCode: error instanceof CloverApiError ? `HTTP_${error.status}` : "AMBIGUOUS_SUBMISSION",
        lastErrorMessage: error instanceof Error ? error.message : String(error),
        sanitizedRequest: json(request),
        resolvedAt: status === PrintJobStatus.FAILED ? new Date() : null,
        },
      });
      if (changed.count === 1) await tx.orderEvent.create({ data: { orderId: job.orderId, actorType: job.requestedByActorType, actorId: job.requestedByActorId, actorLabel: job.requestedByLabel, eventType: status === PrintJobStatus.FAILED ? "KITCHEN_PRINT_SUBMISSION_FAILED" : "KITCHEN_PRINT_SUBMISSION_UNKNOWN", metadata: { printJobId: job.id, errorCode: error instanceof CloverApiError ? `HTTP_${error.status}` : "AMBIGUOUS_SUBMISSION" } } });
      else await tx.orderEvent.create({ data: { orderId: job.orderId, actorType: OrderActorType.SYSTEM, actorLabel: "Clover print submitter", eventType: "KITCHEN_PRINT_LATE_SUBMISSION_RESULT_IGNORED", metadata: { printJobId: job.id, outcome: status, errorCode: error instanceof CloverApiError ? `HTTP_${error.status}` : "AMBIGUOUS_SUBMISSION" } } });
      return tx.printJob.findUniqueOrThrow({ where: { id: job.id } });
    });
  }
}

export async function submitInitialPrintForOrder(
  orderId: string,
  client: CloverClient = createCloverClient(),
) {
  const job = await db.printJob.findUnique({ where: { initialForOrderId: orderId } });
  return job ? submitPrintJob(job.id, client) : null;
}

export async function retryFailedPrintJob(input: {
  jobId: string;
  actorId: string;
  actorLabel?: string;
  reason: string;
}) {
  if (!input.reason.trim()) throw new Error("A retry reason is required.");
  return db.$transaction(async (tx) => {
    const job = await tx.printJob.findUniqueOrThrow({ where: { id: input.jobId } });
    if (job.purpose !== PrintJobPurpose.INITIAL || job.status !== PrintJobStatus.FAILED) throw new Error("Only a deterministically failed initial print submission can be retried.");
    const updated = await tx.printJob.update({ where: { id: job.id }, data: { status: PrintJobStatus.PENDING, resolvedAt: null, lastErrorCode: null, lastErrorMessage: null } });
    await tx.orderEvent.create({ data: { orderId: job.orderId, actorType: OrderActorType.ADMIN, actorId: input.actorId, actorLabel: input.actorLabel, eventType: "KITCHEN_PRINT_FAILED_RETRY_AUTHORIZED", message: input.reason, metadata: { printJobId: job.id } } });
    return updated;
  });
}

export async function observePrintJob(jobId: string, client: CloverClient = createCloverClient()) {
  const job = await db.printJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.purpose !== PrintJobPurpose.INITIAL) throw new Error("Only an initial Clover print job can be observed.");
  if (
    !job.providerPrintEventId ||
    (job.status !== PrintJobStatus.SUBMITTED && job.status !== PrintJobStatus.PRINTING)
  ) return job;
  try {
    const event = await client.get<PrintEvent>(
      `/v3/merchants/${encodeURIComponent(client.config.merchantId)}/print_event/${encodeURIComponent(job.providerPrintEventId)}`,
    );
    const state = event.state?.toUpperCase();
    const observedStatus = state === "FAILED" ? PrintJobStatus.FAILED : state === "PRINTING" ? PrintJobStatus.PRINTING : PrintJobStatus.SUBMITTED;
    const status = job.status === PrintJobStatus.PRINTING && observedStatus === PrintJobStatus.SUBMITTED
      ? PrintJobStatus.PRINTING
      : observedStatus;
    return db.$transaction(async (tx) => {
      const changed = await tx.printJob.updateMany({
        where: { id: job.id, status: job.status },
        data: { status, observedAt: new Date(), sanitizedObservation: json(event), resolvedAt: status === PrintJobStatus.FAILED ? new Date() : null },
      });
      if (changed.count === 1) await tx.orderEvent.create({ data: { orderId: job.orderId, actorType: OrderActorType.SYSTEM, actorLabel: "Clover print observer", eventType: `KITCHEN_PRINT_OBSERVED_${status}`, metadata: { printJobId: job.id, providerPrintEventId: job.providerPrintEventId } } });
      return tx.printJob.findUniqueOrThrow({ where: { id: job.id } });
    });
  } catch (error) {
    // Clover removes successful events, so a missing event is ambiguous until
    // line-item printed=true or an order event supplies authoritative evidence.
    return db.$transaction(async (tx) => {
      const changed = await tx.printJob.updateMany({
        where: { id: job.id, status: job.status },
        data: { status: PrintJobStatus.UNKNOWN, observedAt: new Date(), lastErrorCode: error instanceof CloverApiError ? `HTTP_${error.status}` : "OBSERVATION_FAILED", lastErrorMessage: error instanceof Error ? error.message : String(error) },
      });
      if (changed.count === 1) await tx.orderEvent.create({ data: { orderId: job.orderId, actorType: OrderActorType.SYSTEM, actorLabel: "Clover print observer", eventType: "KITCHEN_PRINT_OBSERVATION_UNKNOWN", metadata: { printJobId: job.id, providerPrintEventId: job.providerPrintEventId, errorCode: error instanceof CloverApiError ? `HTTP_${error.status}` : "OBSERVATION_FAILED" } } });
      return tx.printJob.findUniqueOrThrow({ where: { id: job.id } });
    });
  }
}

export async function confirmOrderPrinted(providerOrderId: string, evidence: unknown) {
  return db.$transaction((tx) => confirmOrderPrintedInTransaction(tx, providerOrderId, evidence));
}

export async function confirmOrderPrintedInTransaction(
  tx: Prisma.TransactionClient,
  providerOrderId: string,
  evidence: unknown,
) {
  const external = await tx.externalOrder.findFirst({ where: { providerOrderId, provider: "CLOVER" } });
  if (!external) return null;
  const job = await tx.printJob.findUnique({ where: { initialForOrderId: external.orderId } });
  if (!job || job.status === PrintJobStatus.PRINTED) return job;
  const updated = await tx.printJob.update({
    where: { id: job.id },
    data: { status: PrintJobStatus.PRINTED, observedAt: new Date(), resolvedAt: new Date(), sanitizedObservation: json(evidence) },
  });
  const fallback = await tx.printJob.findFirst({ where: { orderId: external.orderId, purpose: PrintJobPurpose.FALLBACK, status: PrintJobStatus.PRINTED } });
  if (fallback) {
    await tx.operationalAlert.upsert({
      where: { alertKey: `duplicate-ticket-risk:${external.orderId}` },
      create: { alertKey: `duplicate-ticket-risk:${external.orderId}`, category: "DUPLICATE_TICKET_RISK", severity: "CRITICAL", entityType: "Order", entityId: external.orderId, summary: "Clover later confirmed an initial ticket after a browser fallback was printed. Stop production and reconcile physical copies." },
      update: { status: "OPEN", severity: "CRITICAL", lastSeenAt: new Date(), resolvedAt: null, resolutionNote: null },
    });
    await tx.orderEvent.create({ data: { orderId: external.orderId, actorType: OrderActorType.WEBHOOK, actorLabel: "Clover", eventType: "DUPLICATE_TICKET_RISK_DETECTED", metadata: { initialPrintJobId: job.id, fallbackPrintJobId: fallback.id } } });
  }
  await tx.orderEvent.create({
    data: { orderId: external.orderId, actorType: OrderActorType.WEBHOOK, actorLabel: "Clover", eventType: "INITIAL_KITCHEN_PRINT_CONFIRMED", metadata: { printJobId: job.id } },
  });
  return updated;
}
