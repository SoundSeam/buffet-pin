import {
  OrderActorType,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderProductionStatus,
  PrintJobStatus,
  type PrismaClient,
} from "@prisma/client";
import { withSerializableRetry } from "@/lib/db-transactions";
import { dispatchAggregateJobs } from "@/lib/async-jobs/dispatch";
import { canTransitionProductionStatus } from "@/lib/orders/status";

export class ProductionTransitionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ProductionTransitionError";
  }
}

type Actor = { id: string; label?: string };

export async function transitionProduction(
  client: PrismaClient,
  input: { orderId: string; expected: OrderProductionStatus; next: OrderProductionStatus; actor: Actor },
) {
  if (!canTransitionProductionStatus(input.expected, input.next)) {
    throw new ProductionTransitionError("INVALID_TRANSITION", "Invalid production transition.");
  }
  const result = await withSerializableRetry(client, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { printJobs: { where: { status: PrintJobStatus.PRINTED, purpose: { in: ["INITIAL", "FALLBACK"] } } } },
    });
    if (!order) throw new ProductionTransitionError("ORDER_NOT_FOUND", "Order not found.");
    if (order.paymentStatus !== OrderPaymentStatus.PAID) {
      throw new ProductionTransitionError("ORDER_NOT_PAID", "Only paid orders can enter production.");
    }
    if (input.next === OrderProductionStatus.CANCELLED || input.next === OrderProductionStatus.REJECTED) {
      throw new ProductionTransitionError("REFUND_COORDINATOR_REQUIRED", "Use the cancellation or rejection workflow so paid stops enter the durable refund coordinator.");
    }
    if (
      (input.next === OrderProductionStatus.ACCEPTED ||
        input.next === OrderProductionStatus.PREPARING) &&
      order.printJobs.length === 0
    ) {
      throw new ProductionTransitionError("PRINT_NOT_CONFIRMED", "Kitchen print must be confirmed before production release.");
    }
    if (input.next === OrderProductionStatus.PACKED) {
      const [itemCount, checkCount] = await Promise.all([
        tx.orderItem.count({ where: { orderId: input.orderId } }),
        tx.packingCheck.count({ where: { orderId: input.orderId } }),
      ]);
      if (itemCount === 0 || checkCount !== itemCount) {
        throw new ProductionTransitionError("PACKING_INCOMPLETE", "Every order item must be verified before packing completes.");
      }
    }
    const now = new Date();
    const fulfillmentProjection = input.next === OrderProductionStatus.ACCEPTED
      ? OrderFulfillmentStatus.ACCEPTED
      : input.next === OrderProductionStatus.PREPARING || input.next === OrderProductionStatus.PACKING || input.next === OrderProductionStatus.PACKED
        ? OrderFulfillmentStatus.PREPARING
        : input.next === OrderProductionStatus.AT_DISPATCH_DESK
          ? OrderFulfillmentStatus.READY_FOR_PICKUP
          : order.fulfillmentStatus;
    const changed = await tx.order.updateMany({
      where: { id: input.orderId, productionStatus: input.expected },
      data: {
        productionStatus: input.next,
        fulfillmentStatus: fulfillmentProjection,
        ...(input.next === OrderProductionStatus.PREPARING ? { preparationStartedAt: now } : {}),
        ...(input.next === OrderProductionStatus.PACKING ? { packingStartedAt: now } : {}),
        ...(input.next === OrderProductionStatus.PACKED ? { packedAt: now } : {}),
        ...(input.next === OrderProductionStatus.AT_DISPATCH_DESK ? { atDispatchDeskAt: now } : {}),
      },
    });
    if (changed.count !== 1) throw new ProductionTransitionError("STALE_TRANSITION", "Order state changed; refresh and retry.");
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        actorType: OrderActorType.ADMIN,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        eventType: `PRODUCTION_${input.next}`,
        fromProductionStatus: input.expected,
        toProductionStatus: input.next,
        fromFulfillmentStatus: order.fulfillmentStatus,
        toFulfillmentStatus: fulfillmentProjection,
      },
    });
    return tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
  });
  await dispatchAggregateJobs("Order", input.orderId);
  return result;
}

export async function verifyPackingItem(
  client: PrismaClient,
  input: { orderId: string; orderItemId: string; quantity: number; instructionsAcknowledged: boolean; actor: Actor },
) {
  const result = await withSerializableRetry(client, async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order || order.productionStatus !== OrderProductionStatus.PACKING) {
      throw new ProductionTransitionError("NOT_PACKING", "Order is not in packing verification.");
    }
    const item = await tx.orderItem.findFirst({ where: { id: input.orderItemId, orderId: input.orderId } });
    if (!item) throw new ProductionTransitionError("ITEM_NOT_FOUND", "Order item not found.");
    if (input.quantity !== item.quantity || (item.specialInstructions && !input.instructionsAcknowledged)) {
      throw new ProductionTransitionError("PACKING_MISMATCH", "Quantity and instructions must be verified exactly.");
    }
    const check = await tx.packingCheck.upsert({
      where: { orderId_orderItemId: { orderId: input.orderId, orderItemId: item.id } },
      create: { orderId: input.orderId, orderItemId: item.id, expectedQuantity: item.quantity, verifiedQuantity: input.quantity, instructionsAcknowledged: input.instructionsAcknowledged, actorId: input.actor.id, actorLabel: input.actor.label },
      update: { expectedQuantity: item.quantity, verifiedQuantity: input.quantity, instructionsAcknowledged: input.instructionsAcknowledged, actorId: input.actor.id, actorLabel: input.actor.label, verifiedAt: new Date() },
    });
    await tx.orderEvent.create({
      data: { orderId: input.orderId, actorType: OrderActorType.ADMIN, actorId: input.actor.id, actorLabel: input.actor.label, eventType: "PACKING_ITEM_VERIFIED", metadata: { orderItemId: item.id, quantity: item.quantity, instructionsAcknowledged: input.instructionsAcknowledged } },
    });
    return check;
  });
  await dispatchAggregateJobs("Order", input.orderId);
  return result;
}
