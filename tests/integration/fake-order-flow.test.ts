import { describe, expect, it } from "vitest";
import {
  FakeOrderFlowHarness,
  createRecoverablePrintFailureHarness,
} from "../../lib/testing/fake-order-flow";
import { DeterministicScenarioPlan, FakeOrderPrinter, FakePaymentGateway } from "../../lib/providers/fakes";

describe("fake launch flow", () => {
  it("takes one paid order through delivered without credentials", async () => {
    const state = await new FakeOrderFlowHarness().start();
    expect(state.payment).toBe("PAID");
    expect(state.print).toBe("PRINTED");
    expect(state.production).toBe("AT_DISPATCH_DESK");
    expect(state.dispatch).toBe("DELIVERED");
    expect(state.exception).toBeNull();
    expect(state.audit.filter((event) => event === "INITIAL_PRINT_INTENT_CREATED")).toHaveLength(1);
  });

  it("deduplicates repeated and concurrent starts including the initial print intent", async () => {
    const harness = new FakeOrderFlowHarness();
    const [first, second] = await Promise.all([harness.start(), harness.start()]);
    const third = await harness.start();
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first.audit.filter((event) => event === "INITIAL_PRINT_INTENT_CREATED")).toHaveLength(1);
  });

  it("keeps an offline print visible and recovers it explicitly", async () => {
    const harness = createRecoverablePrintFailureHarness();
    const failed = await harness.start();
    expect(failed.payment).toBe("PAID");
    expect(failed.print).toBe("FAILED");
    expect(failed.dispatch).toBe("UNASSIGNED");
    expect(failed.exception).toMatchObject({
      kind: "PAID_BUT_UNPRINTED",
      owner: "ORDER_CONTROLLER",
      ambiguous: false,
    });

    const recovered = await harness.recoverPrint();
    expect(recovered.print).toBe("PRINTED");
    expect(recovered.dispatch).toBe("DELIVERED");
    expect(recovered.exception).toBeNull();
  });

  it("does not print or produce food while payment is unknown", async () => {
    const payment = new FakePaymentGateway(
      new DeterministicScenarioPlan({ "payment.create": ["timeout"] }),
    );
    const state = await new FakeOrderFlowHarness(payment).start();
    expect(state.payment).toBe("UNKNOWN");
    expect(state.print).toBe("NOT_CREATED");
    expect(state.production).toBe("AWAITING_ACCEPTANCE");
    expect(state.exception).toMatchObject({ kind: "PAYMENT_UNKNOWN", ambiguous: true });
  });

  it("reconciles an ambiguous print instead of blindly resubmitting", async () => {
    const printer = new FakeOrderPrinter(
      new DeterministicScenarioPlan({
        "print.submit": ["timeout"],
        "print.status": ["recovery"],
      }),
    );
    const harness = new FakeOrderFlowHarness(new FakePaymentGateway(), printer);
    const unknown = await harness.start();
    expect(unknown.print).toBe("UNKNOWN");
    expect(unknown.exception).toMatchObject({ ambiguous: true });

    const recovered = await harness.recoverPrint();
    expect(recovered.dispatch).toBe("DELIVERED");
  });

  it("does not release fulfillment when a submitted print cannot be observed", async () => {
    const printer = new FakeOrderPrinter(
      new DeterministicScenarioPlan({ "print.status": ["unknown"] }),
    );
    const harness = new FakeOrderFlowHarness(new FakePaymentGateway(), printer);
    const state = await harness.start();
    expect(state.print).toBe("UNKNOWN");
    expect(state.dispatch).toBe("UNASSIGNED");
    expect(state.exception).toMatchObject({
      kind: "PAID_BUT_UNPRINTED",
      ambiguous: true,
    });
  });
});
