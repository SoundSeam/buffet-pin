import "server-only";

import {
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderRefundStatus,
  Prisma,
} from "@prisma/client";

export const publicOrderSelect = {
  publicCode: true,
  serviceType: true,
  paymentStatus: true,
  refundStatus: true,
  fulfillmentStatus: true,
  isAsap: true,
  requestedFor: true,
  estimatedReadyStartAt: true,
  estimatedReadyEndAt: true,
  estimatedDeliveryStartAt: true,
  estimatedDeliveryEndAt: true,
  itemsSubtotalCents: true,
  taxCents: true,
  tipCents: true,
  deliveryFeeCents: true,
  discountCents: true,
  totalCents: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { sortOrder: "asc" },
    select: {
      menuItemNameSnapshot: true,
      menuItemDescriptionSnapshot: true,
      quantity: true,
      unitPriceCents: true,
      modifiersTotalCents: true,
      lineSubtotalCents: true,
      specialInstructions: true,
      modifiers: {
        orderBy: { createdAt: "asc" },
        select: {
          modifierGroupNameSnapshot: true,
          modifierOptionNameSnapshot: true,
          priceDeltaCents: true,
          quantity: true,
        },
      },
    },
  },
  events: {
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      eventType: true,
      fromPaymentStatus: true,
      toPaymentStatus: true,
      fromFulfillmentStatus: true,
      toFulfillmentStatus: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrderSelect;

export type PublicOrderRow = Prisma.OrderGetPayload<{
  select: typeof publicOrderSelect;
}>;

function toIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

const statusTimelineLabels = {
  [OrderFulfillmentStatus.DRAFT]: "Order received",
  [OrderFulfillmentStatus.AWAITING_PAYMENT]: "Order received",
  [OrderFulfillmentStatus.AWAITING_ACCEPTANCE]: "Waiting confirmation",
  [OrderFulfillmentStatus.ACCEPTED]: "Accepted",
  [OrderFulfillmentStatus.PREPARING]: "Preparing",
  [OrderFulfillmentStatus.READY_FOR_PICKUP]: "Ready for delivery",
  [OrderFulfillmentStatus.DRIVER_ASSIGNED]: "Driver assigned",
  [OrderFulfillmentStatus.PICKED_UP]: "Picked up",
  [OrderFulfillmentStatus.ON_THE_WAY]: "On the way",
  [OrderFulfillmentStatus.ARRIVING_SOON]: "Arriving soon",
  [OrderFulfillmentStatus.DELIVERED]: "Delivered",
  [OrderFulfillmentStatus.REJECTED]: "Rejected/refund pending",
  [OrderFulfillmentStatus.CANCELLED]: "Cancelled",
} as const satisfies Record<OrderFulfillmentStatus, string>;

function publicEventTitle({
  fulfillmentStatus,
  paymentStatus,
  eventType,
  refundStatus,
}: {
  fulfillmentStatus: OrderFulfillmentStatus | null;
  paymentStatus: OrderPaymentStatus | null;
  eventType: string;
  refundStatus: OrderRefundStatus;
}) {
  if (eventType === "ORDER_REFUND_REQUESTED") return "Refund pending";
  if (eventType === "ORDER_REFUND_PENDING") return "Refund pending";
  if (eventType === "ORDER_REFUND_COMPLETED") return "Refund completed";
  if (eventType === "ORDER_REFUND_FAILED") return "Refund needs follow-up";

  if (fulfillmentStatus) {
    if (
      fulfillmentStatus === OrderFulfillmentStatus.REJECTED &&
      refundStatus !== OrderRefundStatus.NOT_REQUIRED
    ) {
      return "Rejected/refund pending";
    }

    return statusTimelineLabels[fulfillmentStatus];
  }

  if (paymentStatus === OrderPaymentStatus.PAID) return "Waiting confirmation";
  if (paymentStatus === OrderPaymentStatus.FAILED) return "Payment failed";

  return "Order received";
}

function publicEventDescription({
  fulfillmentStatus,
  eventType,
  paymentStatus,
  serviceType,
}: {
  fulfillmentStatus: OrderFulfillmentStatus | null;
  eventType: string;
  paymentStatus: OrderPaymentStatus | null;
  serviceType: PublicOrderRow["serviceType"];
}) {
  if (eventType === "ORDER_REFUND_REQUESTED") {
    return "A refund has been requested for this order.";
  }
  if (eventType === "ORDER_REFUND_PENDING") {
    return "The refund is being processed.";
  }
  if (eventType === "ORDER_REFUND_COMPLETED") {
    return "The refund has been completed.";
  }
  if (eventType === "ORDER_REFUND_FAILED") {
    return "The team is reviewing the refund.";
  }

  if (paymentStatus === OrderPaymentStatus.PAID && !fulfillmentStatus) {
    return "Payment is confirmed. The restaurant is reviewing the order.";
  }
  if (paymentStatus === OrderPaymentStatus.FAILED) {
    return "Payment was not completed for this order.";
  }

  switch (fulfillmentStatus) {
    case OrderFulfillmentStatus.AWAITING_PAYMENT:
    case OrderFulfillmentStatus.DRAFT:
      return "Your order was created and is waiting for payment confirmation.";
    case OrderFulfillmentStatus.AWAITING_ACCEPTANCE:
      return "Payment is confirmed. The restaurant is reviewing the order.";
    case OrderFulfillmentStatus.ACCEPTED:
      return "The restaurant accepted the order.";
    case OrderFulfillmentStatus.PREPARING:
      return "The kitchen is preparing your order.";
    case OrderFulfillmentStatus.READY_FOR_PICKUP:
      return "Your order is ready for the delivery handoff.";
    case OrderFulfillmentStatus.DRIVER_ASSIGNED:
      return "A driver has been assigned.";
    case OrderFulfillmentStatus.PICKED_UP:
      return "The driver picked up your order.";
    case OrderFulfillmentStatus.ON_THE_WAY:
      return "Your order is out for delivery.";
    case OrderFulfillmentStatus.ARRIVING_SOON:
      return "Your order should arrive soon.";
    case OrderFulfillmentStatus.DELIVERED:
      return "Your order has been delivered.";
    case OrderFulfillmentStatus.REJECTED:
      return "The order could not be accepted. Any required refund is shown above.";
    case OrderFulfillmentStatus.CANCELLED:
      return "The order has been cancelled.";
    default:
      return null;
  }
}

function publicEventKind(eventType: string) {
  if (eventType.startsWith("ORDER_REFUND")) return "REFUND";
  return "STATUS";
}

export function serializePublicOrder(order: PublicOrderRow) {
  const timeline = order.events
    .filter((event) => {
      return (
        event.fromFulfillmentStatus !== null ||
        event.toFulfillmentStatus !== null ||
        event.toPaymentStatus === OrderPaymentStatus.PAID ||
        event.toPaymentStatus === OrderPaymentStatus.FAILED ||
        event.eventType.startsWith("ORDER_REFUND")
      );
    })
    .map((event) => {
      const fulfillmentStatus =
        event.toFulfillmentStatus ?? event.fromFulfillmentStatus ?? null;
      const paymentStatus = event.toPaymentStatus ?? event.fromPaymentStatus ?? null;

      return {
        kind: publicEventKind(event.eventType),
        title: publicEventTitle({
          fulfillmentStatus,
          paymentStatus,
          eventType: event.eventType,
          refundStatus: order.refundStatus,
        }),
        description: publicEventDescription({
          fulfillmentStatus,
          eventType: event.eventType,
          paymentStatus,
          serviceType: order.serviceType,
        }),
        paymentStatus,
        fulfillmentStatus,
        createdAt: event.createdAt.toISOString(),
      };
    })
    .filter((event, index, events) => {
      const previous = events[index - 1];
      return (
        !previous ||
        previous.title !== event.title ||
        previous.fulfillmentStatus !== event.fulfillmentStatus
      );
    });

  return {
    publicCode: order.publicCode,
    serviceType: order.serviceType,
    paymentStatus: order.paymentStatus,
    refundStatus: order.refundStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    isAsap: order.isAsap,
    requestedFor: toIso(order.requestedFor),
    estimatedReadyWindow: {
      startAt: toIso(order.estimatedReadyStartAt),
      endAt: toIso(order.estimatedReadyEndAt),
    },
    estimatedDeliveryWindow: {
      startAt: toIso(order.estimatedDeliveryStartAt),
      endAt: toIso(order.estimatedDeliveryEndAt),
    },
    totals: {
      itemsSubtotalCents: order.itemsSubtotalCents,
      taxCents: order.taxCents,
      tipCents: order.tipCents,
      deliveryFeeCents: order.deliveryFeeCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    items: order.items.map((item) => ({
      name: item.menuItemNameSnapshot,
      description: item.menuItemDescriptionSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      modifiersTotalCents: item.modifiersTotalCents,
      lineSubtotalCents: item.lineSubtotalCents,
      specialInstructions: item.specialInstructions,
      modifiers: item.modifiers.map((modifier) => ({
        groupName: modifier.modifierGroupNameSnapshot,
        optionName: modifier.modifierOptionNameSnapshot,
        priceDeltaCents: modifier.priceDeltaCents,
        quantity: modifier.quantity,
      })),
    })),
    timeline,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
