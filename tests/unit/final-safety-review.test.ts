import { afterEach, describe, expect, it } from "vitest";
import { checkoutIdempotencyMatches, checkoutRequestFingerprint } from "../../lib/orders/checkout-idempotency";
import { signRouteSuggestionEvidence, verifyRouteSuggestionEvidence } from "../../lib/orders/route-evidence";
import { CloverEcommerceChargeError } from "../../lib/clover/ecommerce";
import { getEcommerceFailureDetails } from "../../lib/clover/ecommerce-failures";
import { CloverOrderTotalMismatchError } from "../../lib/clover/platform-orders";

const originalSecret = process.env.DRIVER_SESSION_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.DRIVER_SESSION_SECRET;
  else process.env.DRIVER_SESSION_SECRET = originalSecret;
});

describe("final safety review", () => {
  it("binds idempotency to canonical checkout content including the payment source", () => {
    const first = checkoutRequestFingerprint({ customer: { phone: "+15145550100", name: "A" }, items: [{ id: "meal", quantity: 1 }], cloverPayment: { source: "token-a" } });
    const reordered = checkoutRequestFingerprint({ cloverPayment: { source: "token-a" }, items: [{ quantity: 1, id: "meal" }], customer: { name: "A", phone: "+15145550100" } });
    const changedCart = checkoutRequestFingerprint({ customer: { phone: "+15145550100", name: "A" }, items: [{ id: "meal", quantity: 2 }], cloverPayment: { source: "token-a" } });
    const changedSource = checkoutRequestFingerprint({ customer: { phone: "+15145550100", name: "A" }, items: [{ id: "meal", quantity: 1 }], cloverPayment: { source: "token-b" } });
    expect(reordered).toBe(first);
    expect(changedCart).not.toBe(first);
    expect(changedSource).not.toBe(first);
    expect(checkoutIdempotencyMatches({ checkoutRequestFingerprint: first }, reordered)).toBe(true);
    expect(checkoutIdempotencyMatches({ checkoutRequestFingerprint: null }, first)).toBe(false);
  });

  it("accepts only fresh server-signed routing evidence for the exact driver and stop order", () => {
    const secret = "unit-route-evidence-secret";
    const token = signRouteSuggestionEvidence({ driverId: "driver-1", orderIds: ["order-1", "order-2"], explanation: "Provider ordered the stops.", routingStatus: "ROUTED", durationSeconds: 900, distanceMeters: 4200 }, secret);
    expect(verifyRouteSuggestionEvidence(token, { driverId: "driver-1", orderIds: ["order-1", "order-2"] }, secret)).toMatchObject({ routingStatus: "ROUTED", durationSeconds: 900 });
    expect(verifyRouteSuggestionEvidence(token, { driverId: "driver-2", orderIds: ["order-1", "order-2"] }, secret)).toBeNull();
    expect(verifyRouteSuggestionEvidence(token, { driverId: "driver-1", orderIds: ["order-2", "order-1"] }, secret)).toBeNull();
    expect(verifyRouteSuggestionEvidence(`${token}tampered`, { driverId: "driver-1", orderIds: ["order-1", "order-2"] }, secret)).toBeNull();
  });

  it.each([408, 409, 429, 500])("keeps ambiguous Clover HTTP %s charge outcomes unresolved", (status) => {
    expect(getEcommerceFailureDetails(new CloverEcommerceChargeError("ambiguous", status, {}))).toMatchObject({ terminal: false, code: "CLOVER_ECOMMERCE_API_ERROR" });
  });

  it("treats deterministic Clover payment rejection as terminal", () => {
    expect(getEcommerceFailureDetails(new CloverEcommerceChargeError("declined", 402, {}))).toMatchObject({ terminal: true, code: "CLOVER_PAYMENT_DECLINED" });
  });

  it("stops checkout before payment when Clover calculates a different order total", () => {
    expect(getEcommerceFailureDetails(new CloverOrderTotalMismatchError("mismatch"))).toMatchObject({
      terminal: true,
      code: "CLOVER_ORDER_TOTAL_MISMATCH",
      status: 409,
    });
  });
});
