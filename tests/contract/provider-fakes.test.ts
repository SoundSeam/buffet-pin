import { describe, expect, it } from "vitest";
import {
  DeterministicScenarioPlan,
  FakeCloverOrderGateway,
  FakeGeocodingProvider,
  FakeNotificationProvider,
  FakeOrderPrinter,
  FakePaymentGateway,
  FakeRoutingProvider,
} from "../../lib/providers/fakes";
import type { ProviderScenario } from "../../lib/providers/contracts";

const expectedKind: Record<ProviderScenario, string> = {
  success: "success",
  recovery: "success",
  terminal_failure: "terminal_failure",
  transient_failure: "transient_failure",
  offline: "transient_failure",
  timeout: "unknown",
  unknown: "unknown",
  duplicate: "duplicate",
};

describe("deterministic provider fakes", () => {
  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates payment %s",
    async (scenario) => {
      const gateway = new FakePaymentGateway(
        new DeterministicScenarioPlan({ "payment.create": [scenario] }),
      );
      const result = await gateway.createPayment({
        orderId: "order-1",
        providerOrderId: "provider-order-1",
        paymentMethodToken: "fake-token",
        idempotencyKey: "payment-1",
        amountCents: 1_000,
        currency: "CAD",
      });
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates Clover order %s",
    async (scenario) => {
      const gateway = new FakeCloverOrderGateway(
        new DeterministicScenarioPlan({ "cloverOrder.create": [scenario] }),
      );
      const result = await gateway.createOrder({
        localOrderId: "order-1",
        orderNumber: "BP-0001",
        orderTypeId: "delivery",
        lines: [],
        totalCents: 1_000,
        currency: "CAD",
        idempotencyKey: "order-1",
      });
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates print %s",
    async (scenario) => {
      const printer = new FakeOrderPrinter(
        new DeterministicScenarioPlan({ "print.submit": [scenario] }),
      );
      const result = await printer.submit({
        localOrderId: "order-1",
        providerOrderId: "provider-order-1",
        orderNumber: "BP-0001",
        purpose: "INITIAL",
        idempotencyKey: "initial-order-1",
      });
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates routing %s",
    async (scenario) => {
      const routing = new FakeRoutingProvider(
        new DeterministicScenarioPlan({ "routing.matrix": [scenario] }),
      );
      const result = await routing.computeMatrix([
        { id: "restaurant", latitude: 45.5, longitude: -73.5 },
        { id: "stop-1", latitude: 45.51, longitude: -73.51 },
      ]);
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates geocoding %s",
    async (scenario) => {
      const geocoding = new FakeGeocodingProvider(
        new DeterministicScenarioPlan({ "geocoding.geocode": [scenario] }),
      );
      const result = await geocoding.geocode({
        addressLine1: "1 Test Street",
        city: "Montréal",
        province: "QC",
        postalCode: "H0H 0H0",
        country: "CA",
      });
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates notification %s",
    async (scenario) => {
      const notifications = new FakeNotificationProvider(
        new DeterministicScenarioPlan({ "notification.send": [scenario] }),
      );
      const result = await notifications.send({
        intentId: `intent-${scenario}`,
        recipient: "+15555550100",
        templateKey: "order-paid",
        body: "Synthetic fixture",
      });
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates payment reconciliation %s",
    async (scenario) => {
      const gateway = new FakePaymentGateway(
        new DeterministicScenarioPlan({ "payment.reconcile": [scenario] }),
      );
      const result = await gateway.reconcile({
        providerEventId: `event-${scenario}`,
        providerPaymentId: "payment-1",
        providerOrderId: "order-1",
        paid: true,
      });
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates refund %s",
    async (scenario) => {
      const gateway = new FakePaymentGateway(
        new DeterministicScenarioPlan({ "payment.refund": [scenario] }),
      );
      const result = await gateway.refund({
        orderId: "order-1",
        providerPaymentId: "payment-1",
        idempotencyKey: `refund-${scenario}`,
        reason: "Synthetic test",
        amountCents: 500,
        currency: "CAD",
      });
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates Clover order read %s",
    async (scenario) => {
      const gateway = new FakeCloverOrderGateway(
        new DeterministicScenarioPlan({ "cloverOrder.get": [scenario] }),
      );
      const created = await gateway.createOrder({
        localOrderId: "order-setup",
        orderNumber: "BP-SETUP",
        orderTypeId: "delivery",
        lines: [],
        totalCents: 1_000,
        currency: "CAD",
        idempotencyKey: "order-setup",
      });
      expect(created.kind).toBe("success");
      const result = await gateway.getOrder("fake-order-order-setup");
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates print observation %s",
    async (scenario) => {
      const printer = new FakeOrderPrinter(
        new DeterministicScenarioPlan({ "print.status": [scenario] }),
      );
      const submitted = await printer.submit({
        localOrderId: "order-setup",
        providerOrderId: "provider-order-setup",
        orderNumber: "BP-SETUP",
        purpose: "INITIAL",
        idempotencyKey: "initial-order-setup",
      });
      expect(submitted.kind).toBe("success");
      const result = await printer.getStatus("fake-print-initial-order-setup");
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates ambiguous print reconciliation %s",
    async (scenario) => {
      const printer = new FakeOrderPrinter(
        new DeterministicScenarioPlan({ "print.reconcile": [scenario] }),
      );
      const result = await printer.reconcile({
        providerOrderId: "provider-order-1",
        idempotencyKey: `initial-${scenario}`,
      });
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it.each(Object.keys(expectedKind) as ProviderScenario[])(
    "simulates stop ordering %s",
    async (scenario) => {
      const routing = new FakeRoutingProvider(
        new DeterministicScenarioPlan({ "routing.orderStops": [scenario] }),
      );
      const result = await routing.orderStops(
        { id: "restaurant", latitude: 45.5, longitude: -73.5 },
        [{ id: "stop-1", latitude: 45.51, longitude: -73.51 }],
      );
      expect(result.kind).toBe(expectedKind[scenario]);
    },
  );

  it("simulates routing, geocoding, and notification failure and recovery", async () => {
    const plan = new DeterministicScenarioPlan({
      "routing.matrix": ["transient_failure", "recovery"],
      "geocoding.geocode": ["terminal_failure"],
      "notification.send": ["offline", "recovery"],
    });
    const routing = new FakeRoutingProvider(plan);
    const geocoding = new FakeGeocodingProvider(plan);
    const notifications = new FakeNotificationProvider(plan);
    const points = [
      { id: "restaurant", latitude: 45.5, longitude: -73.5 },
      { id: "stop-1", latitude: 45.51, longitude: -73.51 },
    ];

    expect((await routing.computeMatrix(points)).kind).toBe("transient_failure");
    expect((await routing.computeMatrix(points)).kind).toBe("success");
    expect(
      (
        await geocoding.geocode({
          addressLine1: "1 Test Street",
          city: "Montréal",
          province: "QC",
          postalCode: "H0H 0H0",
          country: "CA",
        })
      ).kind,
    ).toBe("terminal_failure");
    const notification = {
      intentId: "intent-1",
      recipient: "+15555550100",
      templateKey: "order-paid",
      body: "Synthetic fixture",
    };
    expect((await notifications.send(notification)).kind).toBe("transient_failure");
    expect((await notifications.send(notification)).kind).toBe("success");
    expect((await notifications.send(notification)).kind).toBe("duplicate");
  });

  it("deduplicates payment callbacks by provider event ID", async () => {
    const gateway = new FakePaymentGateway();
    const event = {
      providerEventId: "event-1",
      providerPaymentId: "payment-1",
      providerOrderId: "order-1",
      paid: true,
    };
    expect((await gateway.reconcile(event)).kind).toBe("success");
    expect((await gateway.reconcile(event)).kind).toBe("duplicate");
  });

  it("allows the same callback to recover after a transient processing failure", async () => {
    const gateway = new FakePaymentGateway(
      new DeterministicScenarioPlan({
        "payment.reconcile": ["transient_failure", "recovery"],
      }),
    );
    const event = {
      providerEventId: "event-recovery",
      providerPaymentId: "payment-recovery",
      providerOrderId: "order-recovery",
      paid: true,
    };
    expect((await gateway.reconcile(event)).kind).toBe("transient_failure");
    expect((await gateway.reconcile(event)).kind).toBe("success");
    expect((await gateway.reconcile(event)).kind).toBe("duplicate");
  });

  it("deduplicates successful provider requests by idempotency key", async () => {
    const payment = new FakePaymentGateway();
    const request = {
      orderId: "order-idempotent",
      providerOrderId: "provider-order-idempotent",
      paymentMethodToken: "fake-token",
      idempotencyKey: "payment-idempotent",
      amountCents: 1_000,
      currency: "CAD" as const,
    };
    expect((await payment.createPayment(request)).kind).toBe("success");
    expect((await payment.createPayment(request)).kind).toBe("duplicate");
  });
});
