import {
  DriverAssignmentStatus,
  OrderDispatchStatus,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderProductionStatus,
  OrderRefundStatus,
} from "@prisma/client";

export const allowedPaymentTransitions = {
  [OrderPaymentStatus.PENDING]: [
    OrderPaymentStatus.PAID,
    OrderPaymentStatus.FAILED,
  ],
  [OrderPaymentStatus.PAID]: [
    OrderPaymentStatus.REFUNDED,
    OrderPaymentStatus.PARTIALLY_REFUNDED,
  ],
  [OrderPaymentStatus.FAILED]: [OrderPaymentStatus.PAID],
  [OrderPaymentStatus.REFUNDED]: [],
  [OrderPaymentStatus.PARTIALLY_REFUNDED]: [OrderPaymentStatus.REFUNDED],
} as const satisfies Record<OrderPaymentStatus, readonly OrderPaymentStatus[]>;

export const allowedRefundTransitions = {
  [OrderRefundStatus.NOT_REQUIRED]: [
    OrderRefundStatus.REQUIRED,
    OrderRefundStatus.PENDING,
  ],
  [OrderRefundStatus.REQUIRED]: [OrderRefundStatus.PENDING],
  [OrderRefundStatus.PENDING]: [
    OrderRefundStatus.SUCCEEDED,
    OrderRefundStatus.PARTIAL,
    OrderRefundStatus.FAILED,
  ],
  [OrderRefundStatus.SUCCEEDED]: [],
  [OrderRefundStatus.PARTIAL]: [
    OrderRefundStatus.PENDING,
    OrderRefundStatus.SUCCEEDED,
    OrderRefundStatus.FAILED,
  ],
  [OrderRefundStatus.FAILED]: [OrderRefundStatus.PENDING],
} as const satisfies Record<OrderRefundStatus, readonly OrderRefundStatus[]>;

export const allowedFulfillmentTransitions = {
  [OrderFulfillmentStatus.DRAFT]: [OrderFulfillmentStatus.AWAITING_PAYMENT],
  [OrderFulfillmentStatus.AWAITING_PAYMENT]: [
    OrderFulfillmentStatus.AWAITING_ACCEPTANCE,
    OrderFulfillmentStatus.CANCELLED,
  ],
  [OrderFulfillmentStatus.AWAITING_ACCEPTANCE]: [
    OrderFulfillmentStatus.ACCEPTED,
    OrderFulfillmentStatus.REJECTED,
    OrderFulfillmentStatus.CANCELLED,
  ],
  [OrderFulfillmentStatus.ACCEPTED]: [
    OrderFulfillmentStatus.PREPARING,
    OrderFulfillmentStatus.CANCELLED,
  ],
  [OrderFulfillmentStatus.PREPARING]: [
    OrderFulfillmentStatus.READY_FOR_PICKUP,
    OrderFulfillmentStatus.CANCELLED,
  ],
  [OrderFulfillmentStatus.READY_FOR_PICKUP]: [
    OrderFulfillmentStatus.DRIVER_ASSIGNED,
    OrderFulfillmentStatus.DELIVERED,
    OrderFulfillmentStatus.CANCELLED,
  ],
  [OrderFulfillmentStatus.DRIVER_ASSIGNED]: [
    OrderFulfillmentStatus.PICKED_UP,
    OrderFulfillmentStatus.CANCELLED,
  ],
  [OrderFulfillmentStatus.PICKED_UP]: [OrderFulfillmentStatus.ON_THE_WAY],
  [OrderFulfillmentStatus.ON_THE_WAY]: [
    OrderFulfillmentStatus.ARRIVING_SOON,
    OrderFulfillmentStatus.DELIVERED,
  ],
  [OrderFulfillmentStatus.ARRIVING_SOON]: [OrderFulfillmentStatus.DELIVERED],
  [OrderFulfillmentStatus.DELIVERED]: [],
  [OrderFulfillmentStatus.REJECTED]: [],
  [OrderFulfillmentStatus.CANCELLED]: [],
} as const satisfies Record<
  OrderFulfillmentStatus,
  readonly OrderFulfillmentStatus[]
>;

export const allowedProductionTransitions = {
  [OrderProductionStatus.AWAITING_ACCEPTANCE]: [
    OrderProductionStatus.ACCEPTED,
    OrderProductionStatus.REJECTED,
    OrderProductionStatus.CANCELLED,
  ],
  [OrderProductionStatus.ACCEPTED]: [
    OrderProductionStatus.PREPARING,
    OrderProductionStatus.CANCELLED,
  ],
  [OrderProductionStatus.PREPARING]: [
    OrderProductionStatus.PACKING,
    OrderProductionStatus.CANCELLED,
  ],
  [OrderProductionStatus.PACKING]: [
    OrderProductionStatus.PACKED,
    OrderProductionStatus.CANCELLED,
  ],
  [OrderProductionStatus.PACKED]: [
    OrderProductionStatus.AT_DISPATCH_DESK,
    OrderProductionStatus.CANCELLED,
  ],
  [OrderProductionStatus.AT_DISPATCH_DESK]: [OrderProductionStatus.CANCELLED],
  [OrderProductionStatus.REJECTED]: [],
  [OrderProductionStatus.CANCELLED]: [],
} as const satisfies Record<OrderProductionStatus, readonly OrderProductionStatus[]>;

export const allowedDispatchTransitions = {
  [OrderDispatchStatus.UNASSIGNED]: [
    OrderDispatchStatus.RUN_PLANNED,
    OrderDispatchStatus.CANCELLED,
  ],
  [OrderDispatchStatus.RUN_PLANNED]: [
    OrderDispatchStatus.READY_FOR_PICKUP,
    OrderDispatchStatus.UNASSIGNED,
    OrderDispatchStatus.CANCELLED,
  ],
  [OrderDispatchStatus.READY_FOR_PICKUP]: [
    OrderDispatchStatus.PICKED_UP,
    OrderDispatchStatus.UNASSIGNED,
    OrderDispatchStatus.CANCELLED,
  ],
  [OrderDispatchStatus.PICKED_UP]: [
    OrderDispatchStatus.EN_ROUTE,
    OrderDispatchStatus.EXCEPTION,
  ],
  [OrderDispatchStatus.EN_ROUTE]: [
    OrderDispatchStatus.DELIVERED,
    OrderDispatchStatus.EXCEPTION,
  ],
  [OrderDispatchStatus.EXCEPTION]: [
    OrderDispatchStatus.UNASSIGNED,
    OrderDispatchStatus.CANCELLED,
  ],
  [OrderDispatchStatus.DELIVERED]: [],
  [OrderDispatchStatus.CANCELLED]: [],
} as const satisfies Record<OrderDispatchStatus, readonly OrderDispatchStatus[]>;

export const allowedDriverAssignmentTransitions = {
  [DriverAssignmentStatus.ASSIGNED]: [
    DriverAssignmentStatus.PICKED_UP,
    DriverAssignmentStatus.CANCELLED,
  ],
  [DriverAssignmentStatus.PICKED_UP]: [DriverAssignmentStatus.ON_THE_WAY],
  [DriverAssignmentStatus.ON_THE_WAY]: [
    DriverAssignmentStatus.ARRIVING_SOON,
    DriverAssignmentStatus.DELIVERED,
  ],
  [DriverAssignmentStatus.ARRIVING_SOON]: [DriverAssignmentStatus.DELIVERED],
  [DriverAssignmentStatus.DELIVERED]: [],
  [DriverAssignmentStatus.CANCELLED]: [],
} as const satisfies Record<
  DriverAssignmentStatus,
  readonly DriverAssignmentStatus[]
>;

function includesStatus<TStatus extends string>(
  allowed: readonly TStatus[],
  nextStatus: TStatus,
): boolean {
  return allowed.includes(nextStatus);
}

export function canTransitionPaymentStatus(
  fromStatus: OrderPaymentStatus,
  toStatus: OrderPaymentStatus,
): boolean {
  return includesStatus(allowedPaymentTransitions[fromStatus], toStatus);
}

export function canTransitionRefundStatus(
  fromStatus: OrderRefundStatus,
  toStatus: OrderRefundStatus,
): boolean {
  return includesStatus(allowedRefundTransitions[fromStatus], toStatus);
}

export function canTransitionFulfillmentStatus(
  fromStatus: OrderFulfillmentStatus,
  toStatus: OrderFulfillmentStatus,
): boolean {
  return includesStatus(allowedFulfillmentTransitions[fromStatus], toStatus);
}

export function canTransitionDriverAssignmentStatus(
  fromStatus: DriverAssignmentStatus,
  toStatus: DriverAssignmentStatus,
): boolean {
  return includesStatus(allowedDriverAssignmentTransitions[fromStatus], toStatus);
}

export function canTransitionProductionStatus(
  fromStatus: OrderProductionStatus,
  toStatus: OrderProductionStatus,
): boolean {
  return includesStatus(allowedProductionTransitions[fromStatus], toStatus);
}

export function canTransitionDispatchStatus(
  fromStatus: OrderDispatchStatus,
  toStatus: OrderDispatchStatus,
): boolean {
  return includesStatus(allowedDispatchTransitions[fromStatus], toStatus);
}
