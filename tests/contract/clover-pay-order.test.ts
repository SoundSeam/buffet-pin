import { OrderPaymentStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCloverEcommerceCharge } from "../../lib/clover/ecommerce";

afterEach(() => vi.unstubAllGlobals());

describe("Clover mapped-order payment", () => {
  it("pays the intended Atomic Order and separates tip from order amount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "CLOVER-ORDER-1",
      charge: "CLOVER-PAYMENT-1",
      status: "paid",
      paid: true,
      amount_paid: 2600,
      currency: "CAD",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await createCloverEcommerceCharge({
      order: { id: "local-order", orderNumber: "BP-260722-0001", totalCents: 2600, tipCents: 300 } as Parameters<typeof createCloverEcommerceCharge>[0]["order"],
      payment: { id: "local-payment", amountCents: 2600, currency: "CAD", status: OrderPaymentStatus.PENDING } as Parameters<typeof createCloverEcommerceCharge>[0]["payment"],
      source: "tokenized-card-source",
      idempotencyKey: "2c2d3b76-1b84-49d3-a6f4-6bd58f2d265e",
      providerOrderId: "CLOVER-ORDER-1",
      forwardedFor: "203.0.113.10",
      config: {
        env: "sandbox",
        checkoutMode: "iframe",
        merchantId: "merchant",
        publicAccessKey: null,
        privateToken: "private-token",
        platformToken: "platform-token",
        webhookSecret: "secret",
        apiBaseUrl: "https://apisandbox.dev.clover.com",
        ecommerceApiBaseUrl: "https://scl-sandbox.dev.clover.com",
      },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://scl-sandbox.dev.clover.com/v1/orders/CLOVER-ORDER-1/pay",
    );
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(request).toMatchObject({
      amount: 2300,
      tip_amount: 300,
      source: "tokenized-card-source",
      metadata: { orderNumber: "BP-260722-0001" },
    });
    expect(result).toMatchObject({
      providerOrderId: "CLOVER-ORDER-1",
      providerPaymentId: "CLOVER-PAYMENT-1",
      paid: true,
    });
  });

  it("does not treat authorization-only evidence as paid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "CLOVER-ORDER-1",
      charge: "CLOVER-PAYMENT-1",
      status: "authorized",
      outcome: { type: "AUTHORIZED" },
      amount_paid: 0,
      currency: "CAD",
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const result = await createCloverEcommerceCharge({
      order: { id: "local-order", orderNumber: "BP-260722-0002", totalCents: 1150, tipCents: 0 } as Parameters<typeof createCloverEcommerceCharge>[0]["order"],
      payment: { id: "local-payment", amountCents: 1150, currency: "CAD" } as Parameters<typeof createCloverEcommerceCharge>[0]["payment"],
      source: "tokenized-card-source",
      providerOrderId: "CLOVER-ORDER-1",
      config: { env: "sandbox", checkoutMode: "iframe", merchantId: "merchant", publicAccessKey: null, privateToken: "private", platformToken: "platform", webhookSecret: null, apiBaseUrl: "https://apisandbox.dev.clover.com", ecommerceApiBaseUrl: "https://scl-sandbox.dev.clover.com" },
    });
    expect(result.paid).toBe(false);
    expect(result.status).toBe("pending");
  });

  it("accepts Clover's production paid-order response without a redundant paid boolean", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "CLOVER-ORDER-2",
      charge: "CLOVER-PAYMENT-2",
      status: "paid",
      amount: 115,
      amount_paid: 115,
      currency: "cad",
      auth_code: "SANITIZED",
      status_transitions: { paid: 1_785_795_333_538 },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const result = await createCloverEcommerceCharge({
      order: { id: "local-order", orderNumber: "BP-260803-0005", totalCents: 115, tipCents: 0 } as Parameters<typeof createCloverEcommerceCharge>[0]["order"],
      payment: { id: "local-payment", amountCents: 115, currency: "CAD" } as Parameters<typeof createCloverEcommerceCharge>[0]["payment"],
      source: "tokenized-card-source",
      providerOrderId: "CLOVER-ORDER-2",
      config: { env: "production", checkoutMode: "iframe", merchantId: "merchant", publicAccessKey: null, privateToken: "private", platformToken: "platform", webhookSecret: null, apiBaseUrl: "https://api.clover.com", ecommerceApiBaseUrl: "https://scl.clover.com" },
    });
    expect(result).toMatchObject({ status: "paid", paid: true, providerPaymentId: "CLOVER-PAYMENT-2" });
  });
});
