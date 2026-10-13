import {
  OrderActorType,
  OrderPaymentStatus,
  Prisma,
  PrintJobPurpose,
  PrintJobStatus,
  type PrismaClient,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { withSerializableRetry } from "@/lib/db-transactions";

type PrintActor = {
  actorType: OrderActorType;
  actorId?: string;
  actorLabel?: string;
};

export async function ensureInitialPrintIntentInTransaction(
  transaction: Prisma.TransactionClient,
  orderId: string,
  actor: PrintActor = { actorType: OrderActorType.SYSTEM, actorLabel: "payment-reconciliation" },
) {
  const order = await transaction.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true },
  });
  if (!order) throw new Error("Order not found.");
  if (order.paymentStatus !== OrderPaymentStatus.PAID) {
    throw new Error("Initial kitchen print requires confirmed payment.");
  }
  const printJobId = randomUUID();
  const inserted = await transaction.printJob.createMany({
    data: [{
      id: printJobId,
      orderId,
      initialForOrderId: orderId,
      purpose: PrintJobPurpose.INITIAL,
      idempotencyKey: `print:initial:${orderId}`,
      requestedByActorType: actor.actorType,
      requestedByActorId: actor.actorId,
      requestedByLabel: actor.actorLabel,
    }],
    skipDuplicates: true,
  });
  if (inserted.count === 1) {
    await transaction.orderEvent.create({
      data: {
        orderId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        actorLabel: actor.actorLabel,
        eventType: "INITIAL_PRINT_INTENT_CREATED",
        metadata: { printJobId },
      },
    });
  }
  return transaction.printJob.findUniqueOrThrow({ where: { initialForOrderId: orderId } });
}

export async function ensureInitialPrintIntent(
  client: PrismaClient,
  orderId: string,
  actor: PrintActor = { actorType: OrderActorType.SYSTEM, actorLabel: "payment-reconciliation" },
) {
  try {
    return await withSerializableRetry(client, async (transaction) => {
      return ensureInitialPrintIntentInTransaction(transaction, orderId, actor);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await client.printJob.findUnique({ where: { initialForOrderId: orderId } });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function createReprintIntent(
  client: PrismaClient,
  input: {
    orderId: string;
    reason: string;
    requestKey: string;
    actor: Required<Pick<PrintActor, "actorType" | "actorId">> & PrintActor;
  },
) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Reprint reason is required.");
  if (!input.requestKey.trim()) throw new Error("Reprint request key is required.");
  return withSerializableRetry(client, async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id: input.orderId },
      select: { paymentStatus: true },
    });
    if (!order) throw new Error("Order not found.");
    if (order.paymentStatus !== OrderPaymentStatus.PAID) {
      throw new Error("Kitchen reprints require confirmed payment.");
    }
    const confirmedTicket = await transaction.printJob.findFirst({ where: { orderId: input.orderId, purpose: { in: [PrintJobPurpose.INITIAL, PrintJobPurpose.FALLBACK] }, status: PrintJobStatus.PRINTED } });
    if (!confirmedTicket) throw new Error("A reprint requires a previously confirmed kitchen ticket.");
    const idempotencyKey = `print:reprint:${input.orderId}:${input.requestKey.trim()}`;
    const existing = await transaction.printJob.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (
        existing.orderId !== input.orderId ||
        existing.reason !== reason ||
        existing.requestedByActorId !== input.actor.actorId
      ) {
        throw new Error("Reprint request key was reused with a different payload.");
      }
      return existing;
    }
    const created = await transaction.printJob.create({
      data: {
        orderId: input.orderId,
        purpose: PrintJobPurpose.REPRINT,
        reason,
        idempotencyKey,
        requestedByActorType: input.actor.actorType,
        requestedByActorId: input.actor.actorId,
        requestedByLabel: input.actor.actorLabel,
      },
    });
    await transaction.orderEvent.create({
      data: {
        orderId: input.orderId,
        actorType: input.actor.actorType,
        actorId: input.actor.actorId,
        actorLabel: input.actor.actorLabel,
        eventType: "REPRINT_INTENT_CREATED",
        message: reason,
        metadata: { printJobId: created.id, visiblyLabelAsReprint: true },
      },
    });
    return created;
  });
}

export async function confirmReprintPrinted(
  client: PrismaClient,
  input: { jobId: string; reason: string; actor: Required<Pick<PrintActor, "actorType" | "actorId">> & PrintActor },
) {
  if (!input.reason.trim()) throw new Error("Physical reprint confirmation reason is required.");
  return withSerializableRetry(client, async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "PrintJob" WHERE "id" = ${input.jobId} FOR UPDATE`;
    const job = await transaction.printJob.findUnique({ where: { id: input.jobId }, include: { order: { select: { paymentStatus: true } } } });
    if (!job || job.purpose !== PrintJobPurpose.REPRINT) throw new Error("Reprint job not found.");
    if (job.order.paymentStatus !== OrderPaymentStatus.PAID) throw new Error("An unpaid order cannot be reprinted.");
    if (job.status === PrintJobStatus.PRINTED) return job;
    if (job.status !== PrintJobStatus.PENDING) throw new Error("Reprint is not awaiting physical confirmation.");
    const now = new Date();
    const changed = await transaction.printJob.updateMany({ where: { id: job.id, status: PrintJobStatus.PENDING }, data: { status: PrintJobStatus.PRINTED, observedAt: now, resolvedAt: now } });
    if (changed.count !== 1) throw new Error("Reprint changed while it was being confirmed.");
    await transaction.orderEvent.create({ data: { orderId: job.orderId, actorType: input.actor.actorType, actorId: input.actor.actorId, actorLabel: input.actor.actorLabel, eventType: "LABELLED_REPRINT_PHYSICALLY_CONFIRMED", message: input.reason.trim(), metadata: { printJobId: job.id, visiblyLabelledReprint: true, originalReason: job.reason } } });
    return transaction.printJob.findUniqueOrThrow({ where: { id: job.id } });
  });
}

export async function createFallbackPrintIntent(
  client: PrismaClient,
  input: {
    orderId: string;
    reason: string;
    requestKey: string;
    actor: Required<Pick<PrintActor, "actorType" | "actorId">> & PrintActor;
  },
) {
  const reason = input.reason.trim();
  if (!reason || !input.requestKey.trim()) throw new Error("Fallback reason and request key are required.");
  return withSerializableRetry(client, async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await transaction.order.findUnique({ where: { id: input.orderId }, select: { paymentStatus: true } });
    if (!order || order.paymentStatus !== OrderPaymentStatus.PAID) throw new Error("Browser fallback requires confirmed payment.");
    const jobs = await transaction.printJob.findMany({ where: { orderId: input.orderId }, orderBy: { createdAt: "asc" } });
    if (jobs.some((job) => (job.purpose === PrintJobPurpose.INITIAL || job.purpose === PrintJobPurpose.FALLBACK) && job.status === PrintJobStatus.PRINTED)) throw new Error("A kitchen ticket is already confirmed printed.");
    const initial = jobs.find((job) => job.purpose === PrintJobPurpose.INITIAL);
    if (!initial || (initial.status !== PrintJobStatus.FAILED && initial.status !== PrintJobStatus.UNKNOWN)) throw new Error("Browser fallback is only available after the initial Clover print is FAILED or UNKNOWN.");
    const activeFallback = jobs.find((job) => job.purpose === PrintJobPurpose.FALLBACK && job.status === PrintJobStatus.PENDING);
    if (activeFallback) return activeFallback;
    const idempotencyKey = `print:fallback:${input.orderId}:${input.requestKey.trim()}`;
    const existing = await transaction.printJob.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
    const created = await transaction.printJob.create({
      data: {
        orderId: input.orderId,
        purpose: PrintJobPurpose.FALLBACK,
        reason,
        idempotencyKey,
        requestedByActorType: input.actor.actorType,
        requestedByActorId: input.actor.actorId,
        requestedByLabel: input.actor.actorLabel,
      },
    });
    await transaction.orderEvent.create({
      data: {
        orderId: input.orderId,
        actorType: input.actor.actorType,
        actorId: input.actor.actorId,
        actorLabel: input.actor.actorLabel,
        eventType: "BROWSER_FALLBACK_PRINT_AUTHORIZED",
        message: reason,
        metadata: { printJobId: created.id, visiblyLabelAsFallback: true },
      },
    });
    return created;
  });
}

export async function confirmFallbackPrint(
  client: PrismaClient,
  input: { jobId: string; reason: string; actor: Required<Pick<PrintActor, "actorType" | "actorId">> & PrintActor },
) {
  if (!input.reason.trim()) throw new Error("Physical print confirmation reason is required.");
  return withSerializableRetry(client, async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "PrintJob" WHERE "id" = ${input.jobId} FOR UPDATE`;
    const job = await transaction.printJob.findUnique({ where: { id: input.jobId }, include: { order: { select: { paymentStatus: true } } } });
    if (!job || job.purpose !== PrintJobPurpose.FALLBACK) throw new Error("Fallback print job not found.");
    if (job.order.paymentStatus !== OrderPaymentStatus.PAID) throw new Error("An unpaid order cannot be released by fallback printing.");
    if (job.status === PrintJobStatus.PRINTED) return job;
    if (job.status !== PrintJobStatus.PENDING) throw new Error("Fallback print is not awaiting physical confirmation.");
    const now = new Date();
    const changed = await transaction.printJob.updateMany({ where: { id: job.id, status: PrintJobStatus.PENDING }, data: { status: PrintJobStatus.PRINTED, observedAt: now, resolvedAt: now } });
    if (changed.count !== 1) throw new Error("Fallback print changed while it was being confirmed.");
    await transaction.orderEvent.create({ data: { orderId: job.orderId, actorType: input.actor.actorType, actorId: input.actor.actorId, actorLabel: input.actor.actorLabel, eventType: "BROWSER_FALLBACK_PRINT_CONFIRMED", message: input.reason.trim(), metadata: { printJobId: job.id, physicalConfirmationRequired: true } } });
    return transaction.printJob.findUniqueOrThrow({ where: { id: job.id } });
  });
}
