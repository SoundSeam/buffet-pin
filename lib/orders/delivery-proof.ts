import "server-only";

import { createHash } from "node:crypto";

import {
  DeliveryProofStatus,
  DeliveryRunStatus,
  DeliveryStopStatus,
  OrderActorType,
  OrderDispatchStatus,
  OrderFulfillmentStatus,
  Prisma,
} from "@prisma/client";

import { dispatchAggregateJobs } from "@/lib/async-jobs/dispatch";
import { db } from "@/lib/db";
import { withSerializableRetry } from "@/lib/db-transactions";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class DeliveryProofError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = "DeliveryProofError";
  }
}

function currentStop<T extends { position: number; status: DeliveryStopStatus }>(
  stops: T[],
) {
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .find((stop) =>
      new Set<DeliveryStopStatus>([
        DeliveryStopStatus.PICKED_UP,
        DeliveryStopStatus.EN_ROUTE,
        DeliveryStopStatus.ARRIVED,
      ]).has(stop.status),
    );
}

async function loadScopedRun(
  tx: Prisma.TransactionClient,
  runId: string,
  driverId: string,
) {
  const run = await tx.deliveryRun.findUnique({
    where: { id: runId },
    include: { stops: { orderBy: { position: "asc" }, include: { proof: true } } },
  });
  if (!run || run.driverId !== driverId)
    throw new DeliveryProofError(
      "RUN_SCOPE_DENIED",
      "This run is not assigned to the signed-in driver.",
      403,
    );
  if (!run.handedOffAt || run.status !== DeliveryRunStatus.EN_ROUTE)
    throw new DeliveryProofError(
      "RUN_NOT_DISPATCHED",
      "The restaurant has not dispatched this run.",
    );
  return run;
}

function requireCurrentStop<T extends { orderId: string; position: number; status: DeliveryStopStatus }>(
  stops: T[],
  orderId: string,
) {
  const stop = currentStop(stops);
  if (!stop)
    throw new DeliveryProofError(
      "NO_CURRENT_STOP",
      "This run has no current delivery stop.",
    );
  if (stop.orderId !== orderId)
    throw new DeliveryProofError(
      "STOP_OUT_OF_SEQUENCE",
      "Complete the current stop before opening another delivery.",
    );
  return stop;
}

export async function markDeliveryArrived(input: {
  runId: string;
  orderId: string;
  driverId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const stop = await withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "DeliveryRun" WHERE "id" = ${input.runId} FOR UPDATE`;
    const run = await loadScopedRun(tx, input.runId, input.driverId);
    const current = requireCurrentStop(run.stops, input.orderId);
    if (current.status === DeliveryStopStatus.ARRIVED) return current;
    if (
      !new Set<DeliveryStopStatus>([
        DeliveryStopStatus.PICKED_UP,
        DeliveryStopStatus.EN_ROUTE,
      ]).has(current.status)
    )
      throw new DeliveryProofError(
        "STOP_NOT_ARRIVABLE",
        "The current stop cannot be marked arrived.",
      );
    const updated = await tx.deliveryStop.update({
      where: { id: current.id },
      data: { status: DeliveryStopStatus.ARRIVED, arrivedAt: now },
    });
    await tx.orderEvent.create({
      data: {
        orderId: current.orderId,
        actorType: OrderActorType.DRIVER,
        actorId: input.driverId,
        eventType: "DELIVERY_STOP_ARRIVED",
        fromDispatchStatus: OrderDispatchStatus.EN_ROUTE,
        toDispatchStatus: OrderDispatchStatus.EN_ROUTE,
        metadata: { runId: run.id, stopId: current.id, position: current.position },
      },
    });
    return updated;
  });
  await dispatchAggregateJobs("Order", input.orderId);
  return stop;
}

function decodeProof(base64: string) {
  const normalized = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized))
    throw new DeliveryProofError(
      "PROOF_ENCODING_INVALID",
      "The delivery photo could not be decoded.",
      400,
    );
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.length < 32 || bytes.length > MAX_PROOF_BYTES)
    throw new DeliveryProofError(
      "PROOF_SIZE_INVALID",
      "The delivery photo must be between 32 bytes and 5 MB.",
      400,
    );
  return bytes;
}

function proofSignatureMatches(mimeType: string, bytes: Buffer) {
  if (mimeType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png")
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  if (mimeType === "image/webp")
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  return false;
}

export async function storeDeliveryProof(input: {
  runId: string;
  orderId: string;
  driverId: string;
  mimeType: string;
  base64: string;
  capturedAt: Date;
  now?: Date;
}) {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType))
    throw new DeliveryProofError(
      "PROOF_TYPE_INVALID",
      "Use a JPEG, PNG, or WebP delivery photo.",
      400,
    );
  const now = input.now ?? new Date();
  if (
    !Number.isFinite(input.capturedAt.getTime()) ||
    input.capturedAt.getTime() > now.getTime() + 60_000 ||
    input.capturedAt.getTime() < now.getTime() - 24 * 60 * 60_000
  )
    throw new DeliveryProofError(
      "PROOF_CAPTURE_TIME_INVALID",
      "The delivery photo capture time is invalid.",
      400,
    );
  const bytes = decodeProof(input.base64);
  if (!proofSignatureMatches(input.mimeType, bytes))
    throw new DeliveryProofError(
      "PROOF_CONTENT_INVALID",
      "The delivery photo contents do not match the selected image type.",
      400,
    );
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const proof = await withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "DeliveryRun" WHERE "id" = ${input.runId} FOR UPDATE`;
    const run = await loadScopedRun(tx, input.runId, input.driverId);
    const current = requireCurrentStop(run.stops, input.orderId);
    if (current.status !== DeliveryStopStatus.ARRIVED)
      throw new DeliveryProofError(
        "ARRIVAL_REQUIRED",
        "Mark arrival before adding delivery proof.",
      );
    const existing = current.proof;
    const stored = await tx.deliveryProof.upsert({
      where: { stopId: current.id },
      create: {
        stopId: current.id,
        driverId: input.driverId,
        status: DeliveryProofStatus.STORED,
        mimeType: input.mimeType,
        byteSize: bytes.length,
        checksumSha256,
        imageBytes: bytes,
        capturedAt: input.capturedAt,
      },
      update: {
        driverId: input.driverId,
        status: DeliveryProofStatus.STORED,
        mimeType: input.mimeType,
        byteSize: bytes.length,
        checksumSha256,
        imageBytes: bytes,
        capturedAt: input.capturedAt,
        storedAt: now,
        replacedAt: existing ? now : null,
        failureCode: null,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: current.orderId,
        actorType: OrderActorType.DRIVER,
        actorId: input.driverId,
        eventType: existing
          ? "DELIVERY_PROOF_REPLACED"
          : "DELIVERY_PROOF_STORED",
        metadata: {
          runId: run.id,
          stopId: current.id,
          proofId: stored.id,
          mimeType: stored.mimeType,
          byteSize: stored.byteSize,
          checksumSha256: stored.checksumSha256,
        },
      },
    });
    return stored;
  });
  await dispatchAggregateJobs("Order", input.orderId);
  return {
    id: proof.id,
    status: proof.status,
    mimeType: proof.mimeType,
    byteSize: proof.byteSize,
    checksumSha256: proof.checksumSha256,
    capturedAt: proof.capturedAt,
    storedAt: proof.storedAt,
  };
}

export async function finalizeDeliveryWithProof(input: {
  runId: string;
  orderId: string;
  driverId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const result = await withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "DeliveryRun" WHERE "id" = ${input.runId} FOR UPDATE`;
    const run = await tx.deliveryRun.findUnique({
      where: { id: input.runId },
      include: {
        stops: {
          orderBy: { position: "asc" },
          include: { proof: true, order: true },
        },
      },
    });
    if (!run || run.driverId !== input.driverId)
      throw new DeliveryProofError(
        "RUN_SCOPE_DENIED",
        "This run is not assigned to the signed-in driver.",
        403,
      );
    const alreadyDelivered = run.stops.find(
      (stop) =>
        stop.orderId === input.orderId &&
        stop.status === DeliveryStopStatus.DELIVERED,
    );
    if (alreadyDelivered)
      return { stop: alreadyDelivered, nextStop: null, completed: run.status === DeliveryRunStatus.COMPLETED, changed: false };
    const current = requireCurrentStop(run.stops, input.orderId);
    if (current.status !== DeliveryStopStatus.ARRIVED)
      throw new DeliveryProofError(
        "ARRIVAL_REQUIRED",
        "Mark arrival before finalizing delivery.",
      );
    if (!current.proof || current.proof.status !== DeliveryProofStatus.STORED)
      throw new DeliveryProofError(
        "DELIVERY_PROOF_REQUIRED",
        "A stored delivery photo is required before finalizing.",
      );
    const delivered = await tx.deliveryStop.update({
      where: { id: current.id },
      data: { status: DeliveryStopStatus.DELIVERED, deliveredAt: now },
    });
    await tx.order.update({
      where: { id: current.orderId },
      data: {
        dispatchStatus: OrderDispatchStatus.DELIVERED,
        fulfillmentStatus: OrderFulfillmentStatus.DELIVERED,
        completedAt: now,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId: current.orderId,
        actorType: OrderActorType.DRIVER,
        actorId: input.driverId,
        eventType: "DELIVERY_FINALIZED_WITH_PROOF",
        fromFulfillmentStatus: current.order.fulfillmentStatus,
        toFulfillmentStatus: OrderFulfillmentStatus.DELIVERED,
        fromDispatchStatus: current.order.dispatchStatus,
        toDispatchStatus: OrderDispatchStatus.DELIVERED,
        metadata: {
          runId: run.id,
          stopId: current.id,
          proofId: current.proof.id,
          proofChecksumSha256: current.proof.checksumSha256,
        },
      },
    });
    const next = run.stops.find(
      (stop) =>
        stop.position > current.position &&
        new Set<DeliveryStopStatus>([
          DeliveryStopStatus.PICKED_UP,
          DeliveryStopStatus.EN_ROUTE,
        ]).has(stop.status),
    );
    if (next) {
      const nextStop = await tx.deliveryStop.update({
        where: { id: next.id },
        data: { status: DeliveryStopStatus.EN_ROUTE },
      });
      await tx.orderEvent.create({
        data: {
          orderId: next.orderId,
          actorType: OrderActorType.SYSTEM,
          actorLabel: "Driver stop sequence",
          eventType: "DELIVERY_STOP_FOCUSED",
          fromDispatchStatus: OrderDispatchStatus.EN_ROUTE,
          toDispatchStatus: OrderDispatchStatus.EN_ROUTE,
          metadata: { runId: run.id, stopId: next.id, position: next.position },
        },
      });
      return { stop: delivered, nextStop, completed: false, changed: true };
    }
    await tx.deliveryRun.update({
      where: { id: run.id },
      data: { status: DeliveryRunStatus.COMPLETED, completedAt: now },
    });
    return { stop: delivered, nextStop: null, completed: true, changed: true };
  });
  if (result.changed) await dispatchAggregateJobs("Order", input.orderId);
  return result;
}

export async function failCurrentDelivery(input: {
  runId: string;
  orderId: string;
  driverId: string;
  reason: string;
  now?: Date;
}) {
  const reason = input.reason.trim();
  if (!reason)
    throw new DeliveryProofError(
      "EXCEPTION_REASON_REQUIRED",
      "A delivery exception requires a reason.",
      400,
    );
  const now = input.now ?? new Date();
  const result = await withSerializableRetry(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "DeliveryRun" WHERE "id" = ${input.runId} FOR UPDATE`;
    const run = await loadScopedRun(tx, input.runId, input.driverId);
    const current = requireCurrentStop(run.stops, input.orderId);
    const stop = await tx.deliveryStop.update({
      where: { id: current.id },
      data: {
        status: DeliveryStopStatus.FAILED,
        failedAt: now,
        exceptionCode: "DRIVER_EXCEPTION",
        exceptionNote: reason,
      },
    });
    await tx.order.update({
      where: { id: current.orderId },
      data: { dispatchStatus: OrderDispatchStatus.EXCEPTION },
    });
    await tx.deliveryRun.update({
      where: { id: run.id },
      data: { status: DeliveryRunStatus.EXCEPTION },
    });
    await tx.orderEvent.create({
      data: {
        orderId: current.orderId,
        actorType: OrderActorType.DRIVER,
        actorId: input.driverId,
        eventType: "DELIVERY_STOP_FAILED",
        fromDispatchStatus: OrderDispatchStatus.EN_ROUTE,
        toDispatchStatus: OrderDispatchStatus.EXCEPTION,
        message: reason,
        metadata: { runId: run.id, stopId: current.id },
      },
    });
    return stop;
  });
  await dispatchAggregateJobs("Order", input.orderId);
  return result;
}

export async function purgeExpiredDeliveryProofs(now = new Date()) {
  const settings = await db.restaurantOrderSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const cutoff = new Date(
    now.getTime() - settings.proofRetentionDays * 24 * 60 * 60_000,
  );
  const expired = await db.deliveryProof.findMany({
    where: { storedAt: { lt: cutoff } },
    take: 100,
    orderBy: { storedAt: "asc" },
    include: { stop: { select: { orderId: true } } },
  });
  if (expired.length === 0) return { deleted: 0, cutoff };
  await db.$transaction(async (tx) => {
    await tx.operationalAuditEvent.createMany({
      data: expired.map((proof) => ({
        actorType: OrderActorType.SYSTEM,
        actorLabel: "Delivery proof retention",
        eventType: "DELIVERY_PROOF_RETENTION_PURGED",
        entityType: "DeliveryProof",
        entityId: proof.id,
        metadata: {
          stopId: proof.stopId,
          orderId: proof.stop.orderId,
          storedAt: proof.storedAt.toISOString(),
          retentionDays: settings.proofRetentionDays,
        },
      })),
    });
    await tx.deliveryProof.deleteMany({
      where: { id: { in: expired.map((proof) => proof.id) } },
    });
  });
  return { deleted: expired.length, cutoff };
}
