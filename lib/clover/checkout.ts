import "server-only";

import { type Order, type OrderItem, type OrderItemModifier, type Payment } from "@prisma/client";

import { getAppUrl } from "@/lib/env";
import { createCloverClient, type CloverClient } from "@/lib/clover/client";

const CREATE_CHECKOUT_PATH = "/invoicingcheckoutservice/v1/checkouts";

type OrderItemWithModifiers = OrderItem & {
  modifiers: OrderItemModifier[];
};

export type CloverCheckoutOrder = Order & {
  items: OrderItemWithModifiers[];
};

export type CloverCheckoutPayment = Payment;

type CloverCheckoutLineItem = {
  name: string;
  note?: string;
  price: number;
  unitQty: number;
};

export type CloverCheckoutPayload = {
  customer: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
  };
  redirectUrls: {
    success: string;
    failure: string;
  };
  shoppingCart: {
    lineItems: CloverCheckoutLineItem[];
  };
};

export type CloverCheckoutResponse = {
  href: string;
  checkoutSessionId: string;
  createdTime?: number;
  expirationTime?: number;
  [key: string]: unknown;
};

export type CloverHostedCheckoutSession = {
  checkoutSessionId: string;
  hostedCheckoutUrl: string;
  sessionExpiresAt: Date | null;
  rawProviderData: CloverCheckoutResponse;
  requestPayload: CloverCheckoutPayload;
};

function splitCustomerName(name: string): { firstName: string; lastName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? name.trim();
  const lastName = parts.length > 0 ? parts.join(" ") : undefined;

  return { firstName, lastName };
}

function buildRedirectUrl(path: string, order: CloverCheckoutOrder, payment: Payment) {
  const url = new URL(path, getAppUrl());
  url.searchParams.set("order", order.publicCode);
  url.searchParams.set("payment", payment.id);

  return url.toString();
}

function buildItemNote(item: OrderItemWithModifiers): string {
  const modifierText = item.modifiers
    .map((modifier) => modifier.modifierOptionNameSnapshot)
    .join(", ");
  const notes = [
    modifierText ? `Modifiers: ${modifierText}` : null,
    item.specialInstructions ? `Instructions: ${item.specialInstructions}` : null,
  ].filter(Boolean);

  return notes.join(" | ");
}

function addLineItem(
  lineItems: CloverCheckoutLineItem[],
  name: string,
  price: number,
  unitQty = 1,
  note?: string,
) {
  if (price === 0) {
    return;
  }

  lineItems.push({
    name,
    price,
    unitQty,
    ...(note ? { note } : {}),
  });
}

function calculateCloverPayloadTotal(payload: CloverCheckoutPayload): number {
  return payload.shoppingCart.lineItems.reduce(
    (total, item) => total + item.price * item.unitQty,
    0,
  );
}

export function buildCloverCheckoutPayload(
  order: CloverCheckoutOrder,
  payment: CloverCheckoutPayment,
): CloverCheckoutPayload {
  const { firstName, lastName } = splitCustomerName(order.customerName);
  const lineItems: CloverCheckoutLineItem[] = [];

  for (const [index, item] of order.items.entries()) {
    const itemNote = buildItemNote(item);
    const referenceNote =
      index === 0
        ? [`Buffet Pin order ${order.publicCode}; payment ${payment.id}`, itemNote]
            .filter(Boolean)
            .join(" | ")
        : itemNote;

    addLineItem(
      lineItems,
      item.menuItemNameSnapshot,
      Math.round(item.lineSubtotalCents / item.quantity),
      item.quantity,
      referenceNote,
    );
  }

  addLineItem(lineItems, "GST", order.gstCents);
  addLineItem(lineItems, "QST", order.qstCents);
  addLineItem(lineItems, "Delivery", order.deliveryFeeCents);
  addLineItem(lineItems, "Tip", order.tipCents);
  addLineItem(lineItems, "Discount", -order.discountCents);

  const payload: CloverCheckoutPayload = {
    customer: {
      firstName,
      ...(lastName ? { lastName } : {}),
      ...(order.customerEmail ? { email: order.customerEmail } : {}),
      phoneNumber: order.customerPhone,
    },
    redirectUrls: {
      success: buildRedirectUrl("/order/payment/success", order, payment),
      failure: buildRedirectUrl("/order/payment/failure", order, payment),
    },
    shoppingCart: {
      lineItems,
    },
  };
  const cloverTotalCents = calculateCloverPayloadTotal(payload);

  if (cloverTotalCents !== order.totalCents) {
    throw new Error(
      `Clover checkout payload total mismatch for order ${order.id}: expected ${order.totalCents}, got ${cloverTotalCents}.`,
    );
  }

  if (payment.amountCents !== order.totalCents) {
    throw new Error(
      `Payment amount mismatch for order ${order.id}: expected ${order.totalCents}, got ${payment.amountCents}.`,
    );
  }

  return payload;
}

function parseCloverExpiration(value: number | undefined): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value);
}

export async function createHostedCheckoutSession({
  order,
  payment,
  client = createCloverClient(),
}: {
  order: CloverCheckoutOrder;
  payment: CloverCheckoutPayment;
  client?: CloverClient;
}): Promise<CloverHostedCheckoutSession> {
  const requestPayload = buildCloverCheckoutPayload(order, payment);
  const response = await client.post<CloverCheckoutResponse>(
    CREATE_CHECKOUT_PATH,
    requestPayload,
  );

  if (!response.href || !response.checkoutSessionId) {
    throw new Error("Clover checkout response did not include href and checkoutSessionId.");
  }

  return {
    checkoutSessionId: response.checkoutSessionId,
    hostedCheckoutUrl: response.href,
    sessionExpiresAt: parseCloverExpiration(response.expirationTime),
    rawProviderData: response,
    requestPayload,
  };
}
