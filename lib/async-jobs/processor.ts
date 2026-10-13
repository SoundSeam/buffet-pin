import "server-only";

import { randomUUID } from "node:crypto";

import { AsyncJobState, type AsyncJob } from "@prisma/client";

import { ASYNC_JOB_LEASE_MS, asyncJobKinds } from "@/lib/async-jobs/constants";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { scanOperationalAlerts } from "@/lib/operations/alerts";
import { deliverNotification } from "@/lib/orders/notifications";
import { opaqueEntityChannel, adminUpdatesChannel, type InvalidationEnvelope } from "@/lib/realtime/channels";
import { deliverReservationReminder } from "@/lib/reservations/reminders";

export type ProcessedAsyncJob = {
  jobId: string;
  state: "COMPLETED" | "NOOP";
  invalidations: Array<{ channel: string; event: InvalidationEnvelope }>;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function invalidationsFor(job: AsyncJob): Promise<ProcessedAsyncJob["invalidations"]> {
  const revision =
    job.payload && typeof job.payload === "object" && !Array.isArray(job.payload) &&
    "revision" in job.payload && typeof job.payload.revision === "string"
      ? job.payload.revision
      : job.id;
  const event = { entity: job.aggregateType, id: job.aggregateId, revision };
  const channels = [{ channel: adminUpdatesChannel, event }];
  const secret = getEnv().REALTIME_SIGNING_SECRET;
  if (secret && job.aggregateType === "Order") {
    channels.push({ channel: opaqueEntityChannel("order", job.aggregateId, secret), event });
    const assignment = await db.driverAssignment.findUnique({
      where: { orderId: job.aggregateId },
      select: { driverId: true },
    });
    const activeStop = assignment ? null : await db.deliveryStop.findFirst({
      where: {
        orderId: job.aggregateId,
        run: { status: { in: ["APPROVED", "READY", "PICKED_UP", "EN_ROUTE", "EXCEPTION"] } },
      },
      select: { run: { select: { driverId: true } } },
    });
    const driverId = assignment?.driverId ?? activeStop?.run.driverId;
    if (driverId) channels.push({ channel: `/updates/driver/${driverId}`, event });
  }
  if (secret && job.aggregateType === "Reservation") {
    channels.push({ channel: opaqueEntityChannel("reservation", job.aggregateId, secret), event });
  }
  return channels;
}

async function handle(job: AsyncJob) {
  switch (job.kind) {
    case asyncJobKinds.notification:
      return deliverNotification(job.aggregateId);
    case asyncJobKinds.reservationReminder:
      return deliverReservationReminder(job.aggregateId);
    case asyncJobKinds.operationalScan:
      return scanOperationalAlerts();
    case asyncJobKinds.orderAcceptanceDeadline:
      return (await import("@/lib/orders/controller")).expireOrderAcceptance(
        job.aggregateId,
      );
    case asyncJobKinds.realtimeInvalidation:
      return null;
    default:
      throw new Error(`Unsupported async job kind: ${job.kind}`);
  }
}

export async function processAsyncJob(jobId: string): Promise<ProcessedAsyncJob> {
  const current = await db.asyncJob.findUnique({ where: { id: jobId } });
  if (!current) throw new Error(`Async job ${jobId} does not exist.`);
  if (current.state === AsyncJobState.COMPLETED || current.state === AsyncJobState.CANCELLED) {
    return { jobId, state: "NOOP", invalidations: [] };
  }

  const leaseToken = randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + ASYNC_JOB_LEASE_MS);
  const claimed = await db.asyncJob.updateMany({
    where: {
      id: jobId,
      OR: [
        { state: { in: [AsyncJobState.PENDING, AsyncJobState.DISPATCHED, AsyncJobState.FAILED] } },
        { state: AsyncJobState.RUNNING, leaseExpiresAt: { lt: now } },
      ],
    },
    data: {
      state: AsyncJobState.RUNNING,
      leaseToken,
      leaseExpiresAt,
      startedAt: now,
      processingAttempts: { increment: 1 },
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
  if (claimed.count !== 1) {
    return { jobId, state: "NOOP", invalidations: [] };
  }

  const job = await db.asyncJob.findUniqueOrThrow({ where: { id: jobId } });
  try {
    await handle(job);
    const completed = await db.asyncJob.updateMany({
      where: { id: jobId, state: AsyncJobState.RUNNING, leaseToken },
      data: {
        state: AsyncJobState.COMPLETED,
        completedAt: new Date(),
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    if (completed.count !== 1) throw new Error(`Async job ${jobId} lost its processing lease.`);
    return { jobId, state: "COMPLETED", invalidations: await invalidationsFor(job) };
  } catch (error) {
    await db.asyncJob.updateMany({
      where: { id: jobId, state: AsyncJobState.RUNNING, leaseToken },
      data: {
        state: AsyncJobState.FAILED,
        failedAt: new Date(),
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode: "HANDLER_FAILED",
        lastErrorMessage: errorText(error).slice(0, 1000),
      },
    });
    throw error;
  }
}
