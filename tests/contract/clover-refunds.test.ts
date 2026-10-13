import { OrderPaymentStatus, PaymentProvider } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { refundCloverPayment } from "../../lib/clover/refunds";

const config = { env: "sandbox", checkoutMode: "iframe", merchantId: "merchant", publicAccessKey: null, privateToken: "ecommerce-token", platformToken: "platform-token", webhookSecret: null, apiBaseUrl: "https://apisandbox.dev.clover.com", ecommerceApiBaseUrl: "https://scl-sandbox.dev.clover.com" } as const;
const payment = { id: "payment-1", provider: PaymentProvider.CLOVER, status: OrderPaymentStatus.PAID, amountCents: 1500, refundedAmountCents: 0, currency: "CAD", providerPaymentId: "charge-1", providerOrderId: "order-1" } as Parameters<typeof refundCloverPayment>[0]["payment"];

describe("Clover Ecommerce refunds", () => {
  it("uses the Ecommerce refund endpoint and stable provider key", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "refund-1", amount: 1500, charge: "charge-1" }), { status: 200 }));
    const result = await refundCloverPayment({ payment, amountCents: 1500, idempotencyKey: "refund:request-1", config, fetcher });
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://scl-sandbox.dev.clover.com/v1/refunds");
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: "Bearer ecommerce-token", "Idempotency-Key": "refund:request-1" });
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toMatchObject({ charge: "charge-1", amount: 1500, reason: "requested_by_customer" });
    expect(result).toMatchObject({ state: "succeeded", providerRefundId: "refund-1" });
  });

  it.each([408, 409, 429, 500])("keeps HTTP %s outcomes unknown", async (status) => {
    const result = await refundCloverPayment({ payment, amountCents: 1500, idempotencyKey: "refund:unknown", config, fetcher: vi.fn().mockResolvedValue(new Response("{}", { status })) });
    expect(result).toMatchObject({ state: "unknown", succeeded: false, unknown: true });
  });

  it("keeps transport and malformed success outcomes unknown", async () => {
    const transport = await refundCloverPayment({ payment, amountCents: 1500, idempotencyKey: "refund:transport", config, fetcher: vi.fn().mockRejectedValue(new Error("timeout")) });
    const malformed = await refundCloverPayment({ payment, amountCents: 1500, idempotencyKey: "refund:malformed", config, fetcher: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })) });
    expect(transport.state).toBe("unknown");
    expect(malformed.state).toBe("unknown");
  });
});
