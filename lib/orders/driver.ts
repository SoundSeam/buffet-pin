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
import {
  canTransitionDriverAssignmentStatus,
  canTransitionFulfillmentStatus,
} from "@/lib/orders/status";

const driverOrderInclude = {
  items: {
    orderBy: { sortOrder: "asc" },
    include: {
      modifiers: {
        orderBy: { createdAt: "asc" },
      },
    },
  },
  driverAssignment: {
    include: {
      driver: true,
    },
  },
} satisfies Prisma.OrderInclude;

type DriverOrderRow = Prisma.OrderGetPayload<{
  include: typeof driverOrderInclude;
}>;

const fulfillmentStatusByAssignmentStatus = {
  [DriverAssignmentStatus.ASSIGNED]: OrderFulfillmentStatus.DRIVER_ASSIGNED,
  [DriverAssignmentStatus.PICKED_UP]: OrderFulfillmentStatus.PICKED_UP,
  [DriverAssignmentStatus.ON_THE_WAY]: OrderFulfillmentStatus.ON_THE_WAY,
  [DriverAssignmentStatus.ARRIVING_SOON]: OrderFulfillmentStatus.ARRIVING_SOON,
  [DriverAssignmentStatus.DELIVERED]: OrderFulfillmentStatus.DELIVERED,
  [DriverAssignmentStatus.CANCELLED]: OrderFulfillmentStatus.CANCELLED,
} as const satisfies Record<DriverAssignmentStatus, OrderFulfillmentStatus>;

export const driverDeliveryStatuses = [
  DriverAssignmentStatus.ASSIGNED,
  DriverAssignmentStatus.PICKED_UP,
  DriverAssignmentStatus.ON_THE_WAY,
  DriverAssignmentStatus.ARRIVING_SOON,
  DriverAssignmentStatus.DELIVERED,
] as const;

export class DriverOrderError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DriverOrderError";
  }
}

function toIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function addressForMap(order: DriverOrderRow) {
  const parts = [
    order.deliveryAddressLine1,
    order.deliveryAddressLine2,
    order.deliveryCity,
    order.deliveryProvince,
    order.deliveryPostalCode,
    order.deliveryCountry,
  ].filter(Boolean);

  return parts.join(", ");
}

function mapUrl(order: DriverOrderRow) {
  if (order.deliveryLatitude !== null && order.deliveryLongitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${order.deliveryLatitude},${order.deliveryLongitude}`,
    )}`;
  }

  const address = addressForMap(order);
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
}

export function serializeDriverOrder(order: DriverOrderRow) {
  const assignment = order.driverAssignment;

  return {
    id: order.id,
    publicCode: order.publicCode,
    serviceType: order.serviceType,
    fulfillmentStatus: order.fulfillmentStatus,
    assignmentStatus: assignment?.status ?? null,
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
    },
    deliveryAddress: {
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
      formatted: addressForMap(order),
      mapUrl: mapUrl(order),
    },
    estimatedDeliveryStartAt: toIso(order.estimatedDeliveryStartAt),
    estimatedDeliveryEndAt: toIso(order.estimatedDeliveryEndAt),
    customerNotes: order.customerNotes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      name: item.menuItemNameSnapshot,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions,
      modifiers: item.modifiers.map((modifier) => ({
        id: modifier.id,
        groupName: modifier.modifierGroupNameSnapshot,
        optionName: modifier.modifierOptionNameSnapshot,
        quantity: modifier.quantity,
      })),
    })),
  };
}

export async function listDriverOrders(driverId: string) {
  const orders = await db.order.findMany({
    where: {
      serviceType: "DELIVERY",
      driverAssignment: {
        is: {
          driverId,
          status: {
            in: [...driverDeliveryStatuses],
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    include: driverOrderInclude,
  });

  return orders.map(serializeDriverOrder);
}

export async function getDriverOrder(driverId: string, orderId: string) {
  const order = await db.order.findFirst({
    where: {
      id: orderId,
      serviceType: "DELIVERY",
      driverAssignment: {
        is: {
          driverId,
          status: {
            in: [...driverDeliveryStatuses],
          },
        },
      },
    },
    include: driverOrderInclude,
  });

  return order ? serializeDriverOrder(order) : null;
}

export async function updateDriverOrderStatus({
  driverId,
  orderId,
  status,
  actorId,
  actorLabel,
}: {
  driverId: string;
  orderId: string;
  status: DriverAssignmentStatus;
  actorId: string;
  actorLabel: string;
}) {
  if (status === DriverAssignmentStatus.CANCELLED) {
    throw new DriverOrderError(400, "STATUS_NOT_ALLOWED", "Drivers cannot cancel assignments.");
  }

  const result = await db.$transaction(async (tx) => {
    const current = await tx.order.findFirst({
      where: {
        id: orderId,
        serviceType: "DELIVERY",
        driverAssignment: {
          is: {
            driverId,
          },
        },
      },
      select: {
        id: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        driverAssignment: true,
      },
    });

    if (!current || !current.driverAssignment) {
      throw new DriverOrderError(404, "ORDER_NOT_FOUND", "Assigned order not found.");
    }

    if (current.paymentStatus !== OrderPaymentStatus.PAID) {
      throw new DriverOrderError(409, "ORDER_NOT_PAID", "Only paid orders can be updated.");
    }

    if (current.driverAssignment.status === status) {
      const order = await tx.order.findFirstOrThrow({
        where: {
          id: orderId,
          driverAssignment: {
            is: {
              driverId,
            },
          },
        },
        include: driverOrderInclude,
      });
      return { order, changed: false, fulfillmentStatus: current.fulfillmentStatus };
    }

    if (!canTransitionDriverAssignmentStatus(current.driverAssignment.status, status)) {
      throw new DriverOrderError(
        409,
        "INVALID_ASSIGNMENT_TRANSITION",
        `Cannot move assignment from ${current.driverAssignment.status} to ${status}.`,
      );
    }

    const fulfillmentStatus = fulfillmentStatusByAssignmentStatus[status];

    if (!canTransitionFulfillmentStatus(current.fulfillmentStatus, fulfillmentStatus)) {
      throw new DriverOrderError(
        409,
        "INVALID_ORDER_TRANSITION",
        `Cannot move order from ${current.fulfillmentStatus} to ${fulfillmentStatus}.`,
      );
    }

    const now = new Date();

    await tx.driverAssignment.update({
      where: { orderId },
      data: {
        status,
        ...(status === DriverAssignmentStatus.PICKED_UP ? { pickedUpAt: now } : {}),
        ...(status === DriverAssignmentStatus.DELIVERED ? { deliveredAt: now } : {}),
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus,
        ...(fulfillmentStatus === OrderFulfillmentStatus.DELIVERED
          ? { completedAt: now }
          : {}),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.DRIVER,
        actorId,
        actorLabel,
        eventType: "ORDER_DRIVER_STATUS_UPDATED",
        fromPaymentStatus: current.paymentStatus,
        toPaymentStatus: current.paymentStatus,
        fromFulfillmentStatus: current.fulfillmentStatus,
        toFulfillmentStatus: fulfillmentStatus,
        metadata: {
          driverId,
          assignmentId: current.driverAssignment.id,
          fromAssignmentStatus: current.driverAssignment.status,
          toAssignmentStatus: status,
        },
      },
    });

    const order = await tx.order.findFirstOrThrow({
      where: {
        id: orderId,
        driverAssignment: {
          is: {
            driverId,
          },
        },
      },
      include: driverOrderInclude,
    });
    return { order, changed: true, fulfillmentStatus };
  });

  if (result.changed) {
    await notifyOrderFulfillmentStatus(orderId, result.fulfillmentStatus, {
      actorId,
      actorLabel,
      driverId,
      assignmentStatus: status,
    });
  }

  return serializeDriverOrder(result.order);
}
