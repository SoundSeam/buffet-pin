import { randomInt } from "node:crypto";
import { DeliveryRunStatus, type PrismaClient } from "@prisma/client";
import { withSerializableRetry } from "@/lib/db-transactions";

export async function createDraftRun(
  client: PrismaClient,
  input: {
    requestKey: string;
    zoneIdSnapshot: string;
    zoneNameSnapshot: string;
    orderIds: string[];
  },
) {
  const orderIds = [...new Set(input.orderIds)];
  if (orderIds.length !== input.orderIds.length) throw new Error("Run orders must be distinct.");
  if (orderIds.length < 1 || orderIds.length > 4) throw new Error("A run requires one to four orders.");

  return withSerializableRetry(client, async (transaction) => {
    const existing = await transaction.deliveryRun.findUnique({
      where: { requestKey: input.requestKey },
      include: { stops: { orderBy: { position: "asc" } } },
    });
    if (existing) {
      const sameIntent =
        existing.zoneIdSnapshot === input.zoneIdSnapshot &&
        existing.zoneNameSnapshot === input.zoneNameSnapshot &&
        existing.stops.length === orderIds.length &&
        existing.stops.every((stop, index) => stop.orderId === orderIds[index]);
      if (!sameIntent) throw new Error("Run request key was reused with a different payload.");
      return existing;
    }

    return transaction.deliveryRun.create({
      data: {
        requestKey: input.requestKey,
        runNumber: `RUN-${Date.now().toString(36).toUpperCase()}-${randomInt(36 ** 3)
          .toString(36)
          .toUpperCase()
          .padStart(3, "0")}`,
        zoneIdSnapshot: input.zoneIdSnapshot,
        zoneNameSnapshot: input.zoneNameSnapshot,
        stops: {
          create: orderIds.map((orderId, index) => ({ orderId, position: index + 1 })),
        },
      },
      include: { stops: { orderBy: { position: "asc" } } },
    });
  });
}

export async function addStopToDraftRun(
  client: PrismaClient,
  input: { runId: string; orderId: string },
) {
  return withSerializableRetry(client, async (transaction) => {
    const run = await transaction.deliveryRun.findUnique({
      where: { id: input.runId },
      include: { stops: true },
    });
    if (!run) throw new Error("Delivery run not found.");
    if (run.status !== DeliveryRunStatus.DRAFT) throw new Error("Only draft runs can be changed.");
    if (run.stops.length >= 4) throw new Error("Delivery run capacity is four orders.");
    if (run.stops.some((stop) => stop.orderId === input.orderId)) {
      throw new Error("Order is already in this run.");
    }
    return transaction.deliveryStop.create({
      data: { runId: input.runId, orderId: input.orderId, position: run.stops.length + 1 },
    });
  });
}
