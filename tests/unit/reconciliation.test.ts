import { describe, expect, it } from "vitest";
import { compareReconciliation, reconciliationDayRange, type LocalReconciliationRow } from "../../lib/orders/reconciliation";

const local: LocalReconciliationRow = {
  orderId: "local-1", orderNumber: "BP-260722-0001", providerPaymentId: "payment-1", providerOrderId: "order-1",
  amountCents: 2000, refundedAmountCents: 0, currency: "CAD", tipCents: 200, taxCents: 235, deliveryFeeCents: 300,
  paymentStatus: "PAID", refundStatus: "NOT_REQUIRED", hasUnknownRefund: false,
};

describe("daily reconciliation", () => {
  it("matches exact provider records", () => {
    const report = compareReconciliation([local], [{ providerPaymentId: "payment-1", providerOrderId: "order-1", amountCents: 2000, refundedAmountCents: 0, tipCents: 200, taxCents: 235, deliveryFeeCents: 300, currency: "cad" }]);
    expect(report.summary.exceptionCount).toBe(0);
    expect(report.rows[0]?.matched).toBe(true);
  });

  it("lists amount, refund, unknown, and provider-only exceptions", () => {
    const report = compareReconciliation([{ ...local, hasUnknownRefund: true }], [
      { providerPaymentId: "payment-1", providerOrderId: "order-1", amountCents: 2100, refundedAmountCents: 500, tipCents: 200, taxCents: 235, deliveryFeeCents: 300, currency: "CAD" },
      { providerPaymentId: "provider-only", amountCents: 100, refundedAmountCents: 0, tipCents: 0, taxCents: 0, deliveryFeeCents: 0, currency: "CAD" },
    ]);
    expect(report.rows[0]?.reasons).toEqual(["AMOUNT_MISMATCH", "REFUND_MISMATCH", "REFUND_UNKNOWN"]);
    expect(report.providerOnly).toHaveLength(1);
    expect(report.summary.exceptionCount).toBe(2);
  });

  it("uses Montréal civil-day boundaries across standard time and daylight saving", () => {
    const winter = reconciliationDayRange("2026-01-15");
    const summer = reconciliationDayRange("2026-07-15");
    const springForward = reconciliationDayRange("2026-03-08");
    expect(winter.start.toISOString()).toBe("2026-01-15T05:00:00.000Z");
    expect(summer.start.toISOString()).toBe("2026-07-15T04:00:00.000Z");
    expect(springForward.end.getTime() - springForward.start.getTime()).toBe(23 * 60 * 60_000);
  });

  it("surfaces duplicate provider payment identifiers", () => {
    const provider = { providerPaymentId: "payment-1", providerOrderId: "order-1", amountCents: 2000, refundedAmountCents: 0, tipCents: 200, taxCents: 235, deliveryFeeCents: 300, currency: "CAD" };
    const report = compareReconciliation([local], [provider, provider]);
    expect(report.duplicateProviderPaymentIds).toEqual(["payment-1"]);
    expect(report.rows[0]?.reasons).toContain("DUPLICATE_PROVIDER_PAYMENT");
    expect(report.summary.exceptionCount).toBe(1);
  });

  it("surfaces tip, tax, and delivery-fee component variances", () => {
    const provider = { providerPaymentId: "payment-1", providerOrderId: "order-1", amountCents: 2000, refundedAmountCents: 0, tipCents: 100, taxCents: 200, deliveryFeeCents: 0, currency: "CAD" };
    expect(compareReconciliation([local], [provider]).rows[0]?.reasons).toEqual(["TIP_MISMATCH", "TAX_MISMATCH", "DELIVERY_FEE_MISMATCH"]);
  });
});
