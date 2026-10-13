import "server-only";

import { OrderFulfillmentStatus, OrderPaymentStatus, type Prisma } from "@prisma/client";
import { OrderPricingError } from "@/lib/orders/pricing";
import { consumeMachineTestGrantInTransaction } from "@/lib/operations/machine-test-grant";

export async function enforceOrderIntakeControls(
  tx: Prisma.TransactionClient,
  options: {
    allowDisabledForTest?: boolean;
    machineTestGrantToken?: string | null;
  } = {},
) {
  await tx.restaurantOrderSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  await tx.$queryRaw`SELECT "id" FROM "RestaurantOrderSettings" WHERE "id" = 1 FOR UPDATE`;
  const settings = await tx.restaurantOrderSettings.findUniqueOrThrow({
    where: { id: 1 },
  });
  let machineTestGrant = null;
  if (settings.intakePausedAt && !options.allowDisabledForTest) {
    machineTestGrant = await consumeMachineTestGrantInTransaction(
      tx,
      options.machineTestGrantToken ?? null,
    );
    if (!machineTestGrant) {
      throw new OrderPricingError(
        "ORDER_INTAKE_PAUSED",
        "Online ordering is paused until the restaurant confirms it is ready.",
      );
    }
  }
  if (!settings.onlineOrderingEnabled && !options.allowDisabledForTest) {
    machineTestGrant ??= await consumeMachineTestGrantInTransaction(
      tx,
      options.machineTestGrantToken ?? null,
    );
    if (!machineTestGrant) {
      throw new OrderPricingError("ONLINE_ORDERING_DISABLED", "Online ordering is currently unavailable.");
    }
  }
  if (settings.maxActiveOrders !== null) {
    const pendingCutoff = new Date(Date.now() - 20 * 60_000);
    const activeOrders = await tx.order.count({ where: {
      fulfillmentStatus: { notIn: [OrderFulfillmentStatus.DELIVERED, OrderFulfillmentStatus.REJECTED, OrderFulfillmentStatus.CANCELLED] },
      OR: [
        { paymentStatus: { in: [OrderPaymentStatus.PAID, OrderPaymentStatus.PARTIALLY_REFUNDED] } },
        { paymentStatus: OrderPaymentStatus.PENDING, createdAt: { gte: pendingCutoff } },
      ],
    } });
    if (activeOrders >= settings.maxActiveOrders) throw new OrderPricingError("ORDER_CAPACITY_REACHED", "Online order capacity is currently full.");
  }
  return { ...settings, machineTestGrantId: machineTestGrant?.id ?? null };
}
