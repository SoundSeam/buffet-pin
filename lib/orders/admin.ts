import "server-only";

import {
  DriverAssignmentStatus,
  OrderActorType,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";
import { notifyOrderFulfillmentStatus } from "@/lib/orders/notifications";
import { canTransitionFulfillmentStatus } from "@/lib/orders/status";

export const adminOrderInclude = {
  items: {
    orderBy: { sortOrder: "asc" },
    include: {
      modifiers: {
        orderBy: { createdAt: "asc" },
      },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" },
  },
  events: {
    orderBy: { createdAt: "desc" },
    take: 25,
  },
  notifications: {
    orderBy: { createdAt: "desc" },
    take: 25,
  },
  driverAssignment: {
    include: {
      driver: true,
    },
  },
} satisfies Prisma.OrderInclude;

export type AdminOrderRow = Prisma.OrderGetPayload<{
  include: typeof adminOrderInclude;
}>;

export class AdminOrderError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminOrderError";
  }
}

function toIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function serializeAdminOrder(order: AdminOrderRow) {
  return {
    id: order.id,
    publicCode: order.publicCode,
    serviceType: order.serviceType,
    paymentStatus: order.paymentStatus,
    refundStatus: order.refundStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    customer: {
      id: order.customerId,
      name: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail,
    },
    deliveryAddress:
      order.serviceType === "DELIVERY"
        ? {
            addressLine1: order.deliveryAddressLine1,
            addressLine2: order.deliveryAddressLine2,
            city: order.deliveryCity,
            province: order.deliveryProvince,
            postalCode: order.deliveryPostalCode,
            country: order.deliveryCountry,
            latitude: order.deliveryLatitude,
            longitude: order.deliveryLongitude,
            distanceKm: order.deliveryDistanceKm,
            instructions: order.deliveryInstructions,
          }
        : null,
    isAsap: order.isAsap,
    requestedFor: toIso(order.requestedFor),
    estimatedReadyStartAt: toIso(order.estimatedReadyStartAt),
    estimatedReadyEndAt: toIso(order.estimatedReadyEndAt),
    estimatedDeliveryStartAt: toIso(order.estimatedDeliveryStartAt),
    estimatedDeliveryEndAt: toIso(order.estimatedDeliveryEndAt),
    totals: {
      itemsSubtotalCents: order.itemsSubtotalCents,
      taxableSubtotalCents: order.taxableSubtotalCents,
      gstCents: order.gstCents,
      qstCents: order.qstCents,
      taxCents: order.taxCents,
      tipCents: order.tipCents,
      deliveryFeeCents: order.deliveryFeeCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    customerNotes: order.customerNotes,
    internalNotes: order.internalNotes,
    rejectionReason: order.rejectionReason,
    acceptedAt: toIso(order.acceptedAt),
    rejectedAt: toIso(order.rejectedAt),
    cancelledAt: toIso(order.cancelledAt),
    completedAt: toIso(order.completedAt),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.menuItemNameSnapshot,
      description: item.menuItemDescriptionSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      modifiersTotalCents: item.modifiersTotalCents,
      lineSubtotalCents: item.lineSubtotalCents,
      specialInstructions: item.specialInstructions,
      sortOrder: item.sortOrder,
      modifiers: item.modifiers.map((modifier) => ({
        id: modifier.id,
        modifierGroupId: modifier.modifierGroupId,
        modifierOptionId: modifier.modifierOptionId,
        groupName: modifier.modifierGroupNameSnapshot,
        optionName: modifier.modifierOptionNameSnapshot,
        priceDeltaCents: modifier.priceDeltaCents,
        quantity: modifier.quantity,
      })),
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      refundStatus: payment.refundStatus,
      amountCents: payment.amountCents,
      refundedAmountCents: payment.refundedAmountCents,
      currency: payment.currency,
      checkoutSessionId: payment.checkoutSessionId,
      providerPaymentId: payment.providerPaymentId,
      providerOrderId: payment.providerOrderId,
      paidAt: toIso(payment.paidAt),
      failedAt: toIso(payment.failedAt),
      refundRequestedAt: toIso(payment.refundRequestedAt),
      refundedAt: toIso(payment.refundedAt),
      failureCode: payment.failureCode,
      failureMessage: payment.failureMessage,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    })),
    driverAssignment: order.driverAssignment
      ? {
          id: order.driverAssignment.id,
          status: order.driverAssignment.status,
          assignedAt: order.driverAssignment.assignedAt.toISOString(),
          pickedUpAt: toIso(order.driverAssignment.pickedUpAt),
          deliveredAt: toIso(order.driverAssignment.deliveredAt),
          cancelledAt: toIso(order.driverAssignment.cancelledAt),
          driver: {
            id: order.driverAssignment.driver.id,
            name: order.driverAssignment.driver.name,
            email: order.driverAssignment.driver.email,
            phone: order.driverAssignment.driver.phone,
          },
        }
      : null,
    events: order.events.map((event) => ({
      id: event.id,
      actorType: event.actorType,
      actorId: event.actorId,
      actorLabel: event.actorLabel,
      eventType: event.eventType,
      fromPaymentStatus: event.fromPaymentStatus,
      toPaymentStatus: event.toPaymentStatus,
      fromFulfillmentStatus: event.fromFulfillmentStatus,
      toFulfillmentStatus: event.toFulfillmentStatus,
      message: event.message,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    })),
    notifications: order.notifications.map((notification) => ({
      id: notification.id,
      recipient: notification.recipient,
      channel: notification.channel,
      templateKey: notification.templateKey,
      status: notification.status,
      provider: notification.provider,
      providerMessageId: notification.providerMessageId,
      sentAt: toIso(notification.sentAt),
      deliveredAt: toIso(notification.deliveredAt),
      failedAt: toIso(notification.failedAt),
      errorMessage: notification.errorMessage,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    })),
  };
}

export async function getSerializedAdminOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: adminOrderInclude,
  });

  return order ? serializeAdminOrder(order) : null;
}

export async function updateOrderFulfillmentStatus({
  orderId,
  status,
  actorId,
  actorLabel,
  prepEstimateMinutes,
}: {
  orderId: string;
  status: OrderFulfillmentStatus;
  actorId: string;
  actorLabel: string;
  prepEstimateMinutes?: number;
}) {
  const result = await db.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        serviceType: true,
        acceptedAt: true,
        estimatedReadyStartAt: true,
        estimatedReadyEndAt: true,
      },
    });

    if (!current) {
      throw new AdminOrderError(404, "ORDER_NOT_FOUND", "Order not found.");
    }

    if (current.paymentStatus !== OrderPaymentStatus.PAID) {
      throw new AdminOrderError(409, "ORDER_NOT_PAID", "Only paid orders can be fulfilled.");
    }

    if (current.fulfillmentStatus === status) {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: adminOrderInclude,
      });
      return { order, changed: false };
    }

    if (!canTransitionFulfillmentStatus(current.fulfillmentStatus, status)) {
      throw new AdminOrderError(
        409,
        "INVALID_STATUS_TRANSITION",
        `Cannot move order from ${current.fulfillmentStatus} to ${status}.`,
      );
    }

    const now = new Date();
    const estimatedReadyEndAt =
      prepEstimateMinutes !== undefined
        ? new Date(now.getTime() + prepEstimateMinutes * 60_000)
        : current.estimatedReadyEndAt;

    await tx.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: status,
        ...(status === OrderFulfillmentStatus.ACCEPTED && !current.acceptedAt
          ? { acceptedAt: now }
          : {}),
        ...(prepEstimateMinutes !== undefined
          ? {
              estimatedReadyStartAt: now,
              estimatedReadyEndAt,
            }
          : {}),
        ...(status === OrderFulfillmentStatus.CANCELLED ? { cancelledAt: now } : {}),
        ...(status === OrderFulfillmentStatus.DELIVERED ? { completedAt: now } : {}),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.ADMIN,
        actorId,
        actorLabel,
        eventType:
          status === OrderFulfillmentStatus.ACCEPTED
            ? "ORDER_ACCEPTED"
            : "ORDER_FULFILLMENT_STATUS_UPDATED",
        fromPaymentStatus: current.paymentStatus,
        toPaymentStatus: current.paymentStatus,
        fromFulfillmentStatus: current.fulfillmentStatus,
        toFulfillmentStatus: status,
        metadata: toPrismaJson({
          prepEstimateMinutes: prepEstimateMinutes ?? null,
          estimatedReadyEndAt: estimatedReadyEndAt?.toISOString() ?? null,
        }),
      },
    });

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: adminOrderInclude,
    });
    return { order, changed: true };
  });

  if (result.changed) {
    await notifyOrderFulfillmentStatus(orderId, status, {
      actorId,
      actorLabel,
      prepEstimateMinutes: prepEstimateMinutes ?? null,
    });

    const refreshed = await getSerializedAdminOrder(orderId);
    if (refreshed) return refreshed;
  }

  return serializeAdminOrder(result.order);
}

export async function assignOrderDriver({
  orderId,
  driverId,
  actorId,
  actorLabel,
}: {
  orderId: string;
  driverId: string;
  actorId: string;
  actorLabel: string;
}) {
  const updated = await db.$transaction(async (tx) => {
    const [current, driver] = await Promise.all([
      tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          serviceType: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          driverAssignment: true,
        },
      }),
      tx.driver.findUnique({
        where: { id: driverId },
        select: { id: true, name: true, email: true, isActive: true },
      }),
    ]);

    if (!current) {
      throw new AdminOrderError(404, "ORDER_NOT_FOUND", "Order not found.");
    }

    if (!driver || !driver.isActive) {
      throw new AdminOrderError(404, "DRIVER_NOT_FOUND", "Active driver not found.");
    }

    if (current.serviceType !== "DELIVERY") {
      throw new AdminOrderError(409, "NOT_DELIVERY_ORDER", "Only delivery orders can be assigned.");
    }

    if (current.paymentStatus !== OrderPaymentStatus.PAID) {
      throw new AdminOrderError(409, "ORDER_NOT_PAID", "Only paid orders can be assigned.");
    }

    const hasAssignment =
      current.driverAssignment &&
      current.driverAssignment.status !== DriverAssignmentStatus.CANCELLED;

    if (
      !hasAssignment &&
      !canTransitionFulfillmentStatus(
        current.fulfillmentStatus,
        OrderFulfillmentStatus.DRIVER_ASSIGNED,
      )
    ) {
      throw new AdminOrderError(
        409,
        "INVALID_STATUS_TRANSITION",
        `Cannot assign a driver while order is ${current.fulfillmentStatus}.`,
      );
    }

    const now = new Date();

    if (current.driverAssignment) {
      await tx.driverAssignment.update({
        where: { orderId },
        data: {
          driverId,
          status: DriverAssignmentStatus.ASSIGNED,
          assignedAt: now,
          pickedUpAt: null,
          deliveredAt: null,
          cancelledAt: null,
        },
      });
    } else {
      await tx.driverAssignment.create({
        data: {
          orderId,
          driverId,
          status: DriverAssignmentStatus.ASSIGNED,
          assignedAt: now,
        },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: OrderFulfillmentStatus.DRIVER_ASSIGNED,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.ADMIN,
        actorId,
        actorLabel,
        eventType: hasAssignment ? "ORDER_DRIVER_REASSIGNED" : "ORDER_DRIVER_ASSIGNED",
        fromPaymentStatus: current.paymentStatus,
        toPaymentStatus: current.paymentStatus,
        fromFulfillmentStatus: current.fulfillmentStatus,
        toFulfillmentStatus: OrderFulfillmentStatus.DRIVER_ASSIGNED,
        message: driver.name,
        metadata: {
          driverId: driver.id,
          driverName: driver.name,
          driverEmail: driver.email,
        },
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: adminOrderInclude,
    });
  });

  await notifyOrderFulfillmentStatus(orderId, OrderFulfillmentStatus.DRIVER_ASSIGNED, {
    actorId,
    actorLabel,
    driverId,
  });

  const refreshed = await getSerializedAdminOrder(orderId);
  return refreshed ?? serializeAdminOrder(updated);
}
