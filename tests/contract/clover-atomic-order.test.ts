import { OrderServiceType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildAtomicOrderPayload,
  getCloverAtomicOrderTotal,
} from "../../lib/clover/atomic-order";

const order = {
  id: "order-1",
  publicCode: "LEGACY",
  legacyPublicTrackingEnabled: false,
  trackingToken: "token",
  orderNumber: "BP-260722-0001",
  serviceType: OrderServiceType.DELIVERY,
  totalCents: 2849,
  tipCents: 300,
  deliveryFeeCents: 0,
  items: [
    {
      id: "line-1",
      menuItemId: "item-local",
      quantity: 2,
      specialInstructions: "No onions",
      modifiers: [{ id: "mod-line", modifierOptionId: "option-local" }],
    },
  ],
} as Parameters<typeof buildAtomicOrderPayload>[0];

describe("Clover Atomic Order payload", () => {
  it("reads the production Atomic Order total from the top-level response", () => {
    expect(getCloverAtomicOrderTotal({ id: "ORDER", total: 115 })).toBe(115);
  });

  it("supports the nested checkout response and fails closed without a usable total", () => {
    expect(getCloverAtomicOrderTotal({ id: "ORDER", orderCart: { total: 115 } })).toBe(115);
    expect(getCloverAtomicOrderTotal({ id: "ORDER" })).toBeNull();
    expect(getCloverAtomicOrderTotal({ id: "ORDER", total: 1.5 })).toBeNull();
  });

  it("uses only verified provider IDs and repeats quantity without losing notes", () => {
    const payload = buildAtomicOrderPayload(order, {
      orderTypeId: "OT-DELIVERY",
      taxRateIds: ["TAX-GST", "TAX-QST"],
      itemIds: { "item-local": "CLOVER-ITEM" },
      modifierIds: { "option-local": "CLOVER-MOD" },
    });
    expect(payload.orderCart.orderType.id).toBe("OT-DELIVERY");
    expect(payload.orderCart.lineItems).toHaveLength(2);
    expect(payload.orderCart.lineItems[0]).toMatchObject({
      item: { id: "CLOVER-ITEM" },
      modifications: [{ modifier: { id: "CLOVER-MOD" } }],
      printed: false,
      note: "Buffet Pin BP-260722-0001 | Instructions: No onions",
      taxRates: [{ id: "TAX-GST" }, { id: "TAX-QST" }],
    });
    expect(payload.expectedLocalTotalCents).toBe(2549);
    expect(payload.orderCart.serviceCharges).toEqual([]);
  });

  it("fails closed for an absent item or modifier mapping", () => {
    expect(() => buildAtomicOrderPayload(order, {
      orderTypeId: "OT", taxRateIds: ["GST", "QST"], deliveryServiceChargeId: "FEE", itemIds: {}, modifierIds: {},
    })).toThrow("Missing Clover item mapping");
  });

  it("fails closed unless both Quebec tax mappings are present", () => {
    expect(() => buildAtomicOrderPayload(order, {
      orderTypeId: "OT", taxRateIds: ["GST"], deliveryServiceChargeId: "FEE",
      itemIds: { "item-local": "ITEM" }, modifierIds: { "option-local": "MOD" },
    })).toThrow("requires verified GST and QST");
  });
});
