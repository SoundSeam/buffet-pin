import "server-only";

import { createHash } from "node:crypto";

import {
  ActionAfterCompletion,
  ConflictException,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  FlexibleTimeWindowMode,
} from "@aws-sdk/client-scheduler";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { AsyncJobLane, AsyncJobState, type AsyncJob } from "@prisma/client";

import { getSchedulerClient, getSqsClient } from "@/lib/async-jobs/aws-client";
import { processAsyncJob } from "@/lib/async-jobs/processor";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";

const SCHEDULE_THRESHOLD_MS = 60_000;
const DISPATCH_STALE_MS = 5 * 60_000;

function message(job: AsyncJob) {
  return JSON.stringify({ jobId: job.id, kind: job.kind, payloadVersion: job.payloadVersion });
}

function scheduleName(jobId: string) {
  return `buffet-pin-${createHash("sha256").update(jobId).digest("hex").slice(0, 32)}`;
}

function awsDestination(job: AsyncJob) {
  const env = getEnv();
  return job.lane === AsyncJobLane.NOTIFICATION
    ? { queueUrl: env.AWS_NOTIFICATION_QUEUE_URL, queueArn: env.AWS_NOTIFICATION_QUEUE_ARN }
    : { queueUrl: env.AWS_CRITICAL_QUEUE_URL, queueArn: env.AWS_CRITICAL_QUEUE_ARN };
}

function atExpression(date: Date) {
  return `at(${date.toISOString().replace(/\.\d{3}Z$/, "")})`;
}

async function sendToAws(job: AsyncJob) {
  const env = getEnv();
  const destination = awsDestination(job);
  if (!destination.queueUrl || !destination.queueArn) throw new Error("Async queue is not configured.");

  if (job.runAt.getTime() > Date.now() + SCHEDULE_THRESHOLD_MS) {
    if (!env.AWS_SCHEDULER_GROUP_NAME || !env.AWS_SCHEDULER_ROLE_ARN) {
      throw new Error("EventBridge Scheduler is not configured.");
    }
    const name = scheduleName(job.id);
    try {
      await getSchedulerClient().send(
        new CreateScheduleCommand({
          Name: name,
          GroupName: env.AWS_SCHEDULER_GROUP_NAME,
          ScheduleExpression: atExpression(job.runAt),
          ScheduleExpressionTimezone: "UTC",
          ActionAfterCompletion: ActionAfterCompletion.DELETE,
          FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
          Target: {
            Arn: destination.queueArn,
            RoleArn: env.AWS_SCHEDULER_ROLE_ARN,
            Input: message(job),
            DeadLetterConfig: env.AWS_SCHEDULER_DLQ_ARN ? { Arn: env.AWS_SCHEDULER_DLQ_ARN } : undefined,
            RetryPolicy: { MaximumEventAgeInSeconds: 3600, MaximumRetryAttempts: 5 },
          },
        }),
      );
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
    }
    return { scheduleName: name, queueMessageId: null };
  }

  const sent = await getSqsClient().send(
    new SendMessageCommand({
      QueueUrl: destination.queueUrl,
      MessageBody: message(job),
      MessageAttributes: {
        jobKind: { DataType: "String", StringValue: job.kind },
        aggregateType: { DataType: "String", StringValue: job.aggregateType },
      },
    }),
  );
  return { scheduleName: null, queueMessageId: sent.MessageId ?? null };
}

async function deleteCancelledSchedules(where: { aggregateType?: string; aggregateId?: string }, limit = 25) {
  const env = getEnv();
  if (env.ASYNC_JOBS_MODE !== "aws" || !env.AWS_SCHEDULER_GROUP_NAME) return { selected: 0, deleted: 0, failed: 0 };
  const jobs = await db.asyncJob.findMany({
    where: {
      ...where,
      state: AsyncJobState.CANCELLED,
      scheduleName: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
    select: { id: true, scheduleName: true },
  });
  const outcomes = await Promise.allSettled(jobs.map(async (job) => {
    try {
      await getSchedulerClient().send(new DeleteScheduleCommand({
        Name: job.scheduleName!,
        GroupName: env.AWS_SCHEDULER_GROUP_NAME,
      }));
    } catch (error) {
      if (!(error && typeof error === "object" && "name" in error && error.name === "ResourceNotFoundException")) throw error;
    }
    await db.asyncJob.updateMany({
      where: { id: job.id, state: AsyncJobState.CANCELLED, scheduleName: job.scheduleName },
      data: { scheduleName: null },
    });
  }));
  return {
    selected: jobs.length,
    deleted: outcomes.filter((result) => result.status === "fulfilled").length,
    failed: outcomes.filter((result) => result.status === "rejected").length,
  };
}

export async function dispatchAsyncJob(jobId: string) {
  const env = getEnv();
  const job = await db.asyncJob.findUnique({ where: { id: jobId } });
  if (!job || job.state === AsyncJobState.COMPLETED || job.state === AsyncJobState.CANCELLED) return;
  if (env.ASYNC_JOBS_MODE === "shadow") return;
  if (env.ASYNC_JOBS_MODE === "inline") {
    await processAsyncJob(jobId);
    return;
  }

  const claimed = await db.asyncJob.updateMany({
    where: { id: jobId, state: { in: [AsyncJobState.PENDING, AsyncJobState.FAILED] } },
    data: {
      state: AsyncJobState.DISPATCHING,
      dispatchAttempts: { increment: 1 },
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
  if (claimed.count !== 1) return;

  try {
    const outcome = await sendToAws(job);
    await db.asyncJob.updateMany({
      where: { id: jobId, state: AsyncJobState.DISPATCHING },
      data: {
        state: AsyncJobState.DISPATCHED,
        dispatchedAt: new Date(),
        scheduleName: outcome.scheduleName,
        queueMessageId: outcome.queueMessageId,
      },
    });
  } catch (error) {
    await db.asyncJob.updateMany({
      where: { id: jobId, state: AsyncJobState.DISPATCHING },
      data: {
        state: AsyncJobState.PENDING,
        lastErrorCode: "DISPATCH_FAILED",
        lastErrorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
      },
    });
    throw error;
  }
}

export async function dispatchAggregateJobs(aggregateType: string, aggregateId: string) {
  await deleteCancelledSchedules({ aggregateType, aggregateId });
  const jobs = await db.asyncJob.findMany({
    where: {
      aggregateType,
      aggregateId,
      state: { in: [AsyncJobState.PENDING, AsyncJobState.FAILED] },
      processingAttempts: { lt: 8 },
    },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: { id: true },
  });
  await Promise.allSettled(jobs.map((job) => dispatchAsyncJob(job.id)));
  return jobs.length;
}

export async function recoverAsyncJobs(limit = 100) {
  const now = new Date();
  const stale = new Date(now.getTime() - DISPATCH_STALE_MS);
  const resetDispatching = await db.asyncJob.updateMany({
    where: { state: AsyncJobState.DISPATCHING, updatedAt: { lt: stale } },
    data: { state: AsyncJobState.PENDING, lastErrorCode: "DISPATCH_LEASE_EXPIRED" },
  });
  const resetRunning = await db.asyncJob.updateMany({
    where: { state: AsyncJobState.RUNNING, leaseExpiresAt: { lt: now } },
    data: {
      state: AsyncJobState.FAILED,
      leaseToken: null,
      leaseExpiresAt: null,
      lastErrorCode: "PROCESSING_LEASE_EXPIRED",
    },
  });
  const jobs = await db.asyncJob.findMany({
    where: {
      state: { in: [AsyncJobState.PENDING, AsyncJobState.FAILED] },
      processingAttempts: { lt: 8 },
    },
    orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(limit, 500)),
    select: { id: true },
  });
  const outcomes = await Promise.allSettled(jobs.map((job) => dispatchAsyncJob(job.id)));
  const cancelledSchedules = await deleteCancelledSchedules({}, limit);
  return {
    selected: jobs.length,
    dispatched: outcomes.filter((result) => result.status === "fulfilled").length,
    failed: outcomes.filter((result) => result.status === "rejected").length,
    resetDispatching: resetDispatching.count,
    resetRunning: resetRunning.count,
    cancelledSchedules,
  };
}
