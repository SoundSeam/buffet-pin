import { OrderFulfillmentStatus, type OrderServiceType, type ReservationLanguage } from "@prisma/client";

import { getAppUrl } from "@/lib/env";
import { BUSINESS_TIME_ZONE } from "@/lib/reservations/time";

const RESTAURANT_NAME = "Buffet PIN";

export const orderNotificationTemplateKeys = {
  paymentConfirmed: "ORDER_PAYMENT_CONFIRMED",
  accepted: "ORDER_ACCEPTED",
  rejectedRefundPending: "ORDER_REJECTED_REFUND_PENDING",
  refundSucceeded: "ORDER_REFUND_SUCCEEDED",
  refundFailedAdminAlert: "ORDER_REFUND_FAILED_ADMIN_ALERT",
  preparing: "ORDER_PREPARING",
  ready: "ORDER_READY",
  driverAssigned: "ORDER_DRIVER_ASSIGNED",
  onTheWay: "ORDER_ON_THE_WAY",
  arrivingSoon: "ORDER_ARRIVING_SOON",
  delivered: "ORDER_DELIVERED",
} as const;

export type OrderNotificationTemplateKey =
  (typeof orderNotificationTemplateKeys)[keyof typeof orderNotificationTemplateKeys];

type OrderTemplateInput = {
  publicCode: string;
  serviceType: OrderServiceType;
  language: ReservationLanguage;
  customerName: string;
  estimatedReadyEndAt?: Date | null;
  estimatedDeliveryEndAt?: Date | null;
  rejectionReason?: string | null;
  driverName?: string | null;
};

type AdminRefundAlertInput = {
  publicCode: string;
  customerName: string;
  customerPhone: string;
  totalCents: number;
  errorMessage?: string | null;
};

function orderStatusUrl(publicCode: string): string {
  return new URL(`/order/${publicCode}`, getAppUrl()).toString();
}

function formatTime(date: Date | null | undefined, language: ReservationLanguage): string | null {
  if (!date) return null;

  return new Intl.DateTimeFormat(language === "FR" ? "fr-CA" : "en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

export function renderOrderNotificationSms(
  templateKey: OrderNotificationTemplateKey,
  input: OrderTemplateInput,
): string {
  const url = orderStatusUrl(input.publicCode);
  const readyTime = formatTime(input.estimatedReadyEndAt, input.language);
  const deliveryTime = formatTime(input.estimatedDeliveryEndAt, input.language);

  if (input.language === "FR") {
    switch (templateKey) {
      case orderNotificationTemplateKeys.paymentConfirmed:
        return `${RESTAURANT_NAME} : paiement confirme pour la commande ${input.publicCode}. Nous la confirmerons bientot.\n\nSuivi : ${url}`;
      case orderNotificationTemplateKeys.accepted:
        return `${RESTAURANT_NAME} : commande ${input.publicCode} acceptee.${readyTime ? ` Prete vers ${readyTime}.` : ""}\n\nSuivi : ${url}`;
      case orderNotificationTemplateKeys.rejectedRefundPending:
        return `${RESTAURANT_NAME} : commande ${input.publicCode} refusee. Le remboursement est en traitement.${input.rejectionReason ? ` Raison : ${input.rejectionReason}` : ""}`;
      case orderNotificationTemplateKeys.refundSucceeded:
        return `${RESTAURANT_NAME} : remboursement complete pour la commande ${input.publicCode}.`;
      case orderNotificationTemplateKeys.preparing:
        return `${RESTAURANT_NAME} : commande ${input.publicCode} en preparation.${readyTime ? ` Prete vers ${readyTime}.` : ""}\n\nSuivi : ${url}`;
      case orderNotificationTemplateKeys.ready:
        return `${RESTAURANT_NAME} : commande ${input.publicCode} prete pour livraison.\n\nSuivi : ${url}`;
      case orderNotificationTemplateKeys.driverAssigned:
        return `${RESTAURANT_NAME} : livreur assigne a la commande ${input.publicCode}${input.driverName ? ` (${input.driverName})` : ""}.${deliveryTime ? ` Arrivee estimee vers ${deliveryTime}.` : ""}\n\nSuivi : ${url}`;
      case orderNotificationTemplateKeys.onTheWay:
        return `${RESTAURANT_NAME} : commande ${input.publicCode} en route.${deliveryTime ? ` Arrivee estimee vers ${deliveryTime}.` : ""}\n\nSuivi : ${url}`;
      case orderNotificationTemplateKeys.arrivingSoon:
        return `${RESTAURANT_NAME} : votre commande ${input.publicCode} arrive bientot.\n\nSuivi : ${url}`;
      case orderNotificationTemplateKeys.delivered:
        return `${RESTAURANT_NAME} : commande ${input.publicCode} livree. Merci!`;
      case orderNotificationTemplateKeys.refundFailedAdminAlert:
        return `${RESTAURANT_NAME} : suivi requis pour la commande ${input.publicCode}.`;
    }
  }

  switch (templateKey) {
    case orderNotificationTemplateKeys.paymentConfirmed:
      return `${RESTAURANT_NAME}: payment confirmed for order ${input.publicCode}. We will confirm your delivery soon.\n\nStatus: ${url}`;
    case orderNotificationTemplateKeys.accepted:
      return `${RESTAURANT_NAME}: order ${input.publicCode} accepted.${readyTime ? ` Ready around ${readyTime}.` : ""}\n\nStatus: ${url}`;
    case orderNotificationTemplateKeys.rejectedRefundPending:
      return `${RESTAURANT_NAME}: order ${input.publicCode} was rejected. Your refund is being processed.${input.rejectionReason ? ` Reason: ${input.rejectionReason}` : ""}`;
    case orderNotificationTemplateKeys.refundSucceeded:
      return `${RESTAURANT_NAME}: refund completed for order ${input.publicCode}.`;
    case orderNotificationTemplateKeys.preparing:
      return `${RESTAURANT_NAME}: order ${input.publicCode} is being prepared.${readyTime ? ` Ready around ${readyTime}.` : ""}\n\nStatus: ${url}`;
    case orderNotificationTemplateKeys.ready:
      return `${RESTAURANT_NAME}: order ${input.publicCode} is ready for delivery.\n\nStatus: ${url}`;
    case orderNotificationTemplateKeys.driverAssigned:
      return `${RESTAURANT_NAME}: driver assigned for order ${input.publicCode}${input.driverName ? ` (${input.driverName})` : ""}.${deliveryTime ? ` Estimated arrival around ${deliveryTime}.` : ""}\n\nStatus: ${url}`;
    case orderNotificationTemplateKeys.onTheWay:
      return `${RESTAURANT_NAME}: order ${input.publicCode} is on the way.${deliveryTime ? ` Estimated arrival around ${deliveryTime}.` : ""}\n\nStatus: ${url}`;
    case orderNotificationTemplateKeys.arrivingSoon:
      return `${RESTAURANT_NAME}: your order ${input.publicCode} is arriving soon.\n\nStatus: ${url}`;
    case orderNotificationTemplateKeys.delivered:
      return `${RESTAURANT_NAME}: order ${input.publicCode} delivered. Thank you!`;
    case orderNotificationTemplateKeys.refundFailedAdminAlert:
      return `${RESTAURANT_NAME}: order ${input.publicCode} needs follow-up.`;
  }
}

export function templateKeyForFulfillmentStatus(
  status: OrderFulfillmentStatus,
): OrderNotificationTemplateKey | null {
  switch (status) {
    case OrderFulfillmentStatus.ACCEPTED:
      return orderNotificationTemplateKeys.accepted;
    case OrderFulfillmentStatus.PREPARING:
      return orderNotificationTemplateKeys.preparing;
    case OrderFulfillmentStatus.READY_FOR_PICKUP:
      return orderNotificationTemplateKeys.ready;
    case OrderFulfillmentStatus.DRIVER_ASSIGNED:
      return orderNotificationTemplateKeys.driverAssigned;
    case OrderFulfillmentStatus.ON_THE_WAY:
      return orderNotificationTemplateKeys.onTheWay;
    case OrderFulfillmentStatus.ARRIVING_SOON:
      return orderNotificationTemplateKeys.arrivingSoon;
    case OrderFulfillmentStatus.DELIVERED:
      return orderNotificationTemplateKeys.delivered;
    default:
      return null;
  }
}

export function renderRefundFailedAdminSms(input: AdminRefundAlertInput): string {
  return [
    "Refund failed",
    `Order: ${input.publicCode}`,
    `Customer: ${input.customerName}`,
    `Phone: ${input.customerPhone}`,
    `Amount: ${formatMoney(input.totalCents)}`,
    `Error: ${input.errorMessage ?? "Manual follow-up required."}`,
  ].join("\n");
}
