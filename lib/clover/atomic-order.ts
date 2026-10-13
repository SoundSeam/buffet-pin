import type { Order, OrderItem, OrderItemModifier } from "@prisma/client";

type MappedOrder = Order & { items: Array<OrderItem & { modifiers: OrderItemModifier[] }> };

export type CloverAtomicOrderResponse = {
  id?: string;
  total?: number;
  orderCart?: { total?: number };
  [key: string]: unknown;
};

export function getCloverAtomicOrderTotal(response: CloverAtomicOrderResponse): number | null {
  const total = typeof response.total === "number"
    ? response.total
    : response.orderCart?.total;

  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
    return null;
  }

  return total;
}

export type CloverCatalogIds = {
  orderTypeId: string;
  taxRateIds: string[];
  deliveryServiceChargeId?: string;
  itemIds: Record<string, string>;
  modifierIds: Record<string, string>;
};

export function buildAtomicOrderPayload(order: MappedOrder, mappings: CloverCatalogIds) {
  if (mappings.taxRateIds.length !== 2) {
    throw new Error("Clover checkout requires verified GST and QST tax mappings.");
  }
  if (order.deliveryFeeCents > 0 && !mappings.deliveryServiceChargeId) {
    throw new Error("Clover checkout requires a verified delivery service-charge mapping.");
  }
  const lineItems = order.items.flatMap((item) => {
    const providerItemId = item.menuItemId ? mappings.itemIds[item.menuItemId] : undefined;
    if (!providerItemId) throw new Error(`Missing Clover item mapping for ${item.menuItemId ?? item.id}.`);
    const modifications = item.modifiers.map((modifier) => {
      const providerModifierId = modifier.modifierOptionId
        ? mappings.modifierIds[modifier.modifierOptionId]
        : undefined;
      if (!providerModifierId) {
        throw new Error(`Missing Clover modifier mapping for ${modifier.modifierOptionId ?? modifier.id}.`);
      }
      return { modifier: { id: providerModifierId } };
    });
    return Array.from({ length: item.quantity }, () => ({
      item: { id: providerItemId },
      printed: false,
      exchanged: false,
      modifications,
      note: [
        `Buffet Pin ${order.orderNumber}`,
        item.specialInstructions ? `Instructions: ${item.specialInstructions}` : null,
      ].filter(Boolean).join(" | "),
      taxRates: mappings.taxRateIds.map((id) => ({ id })),
    }));
  });

  return {
    orderCart: {
      orderType: { id: mappings.orderTypeId },
      note: `Buffet Pin delivery ${order.orderNumber}`,
      lineItems,
      serviceCharges:
        order.deliveryFeeCents > 0
          ? [{ id: mappings.deliveryServiceChargeId!, amount: order.deliveryFeeCents }]
          : [],
    },
    expectedLocalTotalCents: order.totalCents - order.tipCents,
    expectedTipCents: order.tipCents,
  };
}
