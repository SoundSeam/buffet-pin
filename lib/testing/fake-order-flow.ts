import type { OrderPrinter, PaymentGateway } from "../providers/contracts";
import {
  DeterministicScenarioPlan,
  FakeCloverOrderGateway,
  FakeOrderPrinter,
  FakePaymentGateway,
} from "../providers/fakes";

export type FakeOrderFlowState = {
  orderNumber: string;
  payment: "PENDING" | "PAID" | "FAILED" | "UNKNOWN";
  print: "NOT_CREATED" | "SUBMITTED" | "PRINTED" | "FAILED" | "UNKNOWN";
  production:
    | "AWAITING_ACCEPTANCE"
    | "ACCEPTED"
    | "PREPARING"
    | "PACKED"
    | "AT_DISPATCH_DESK";
  dispatch: "UNASSIGNED" | "ASSIGNED" | "PICKED_UP" | "EN_ROUTE" | "DELIVERED";
  exception: null | {
    kind: "PAYMENT_UNKNOWN" | "PAID_BUT_UNPRINTED";
    owner: "PAYMENT_RECONCILIATION" | "ORDER_CONTROLLER";
    recoveryAction: string;
    ambiguous: boolean;
  };
  audit: string[];
};

export class FakeOrderFlowHarness {
  readonly state: FakeOrderFlowState = {
    orderNumber: "BP-0722-0001",
    payment: "PENDING",
    print: "NOT_CREATED",
    production: "AWAITING_ACCEPTANCE",
    dispatch: "UNASSIGNED",
    exception: null,
    audit: [],
  };

  private providerOrderId: string | null = null;
  private readonly initialPrintIdempotencyKey = "initial-local-order-1";
  private executionPromise: Promise<FakeOrderFlowState> | null = null;

  constructor(
    private readonly paymentGateway: PaymentGateway = new FakePaymentGateway(),
    private readonly printer: OrderPrinter = new FakeOrderPrinter(),
  ) {}

  start(): Promise<FakeOrderFlowState> {
    this.executionPromise ??= this.execute();
    return this.executionPromise;
  }

  private async execute(): Promise<FakeOrderFlowState> {
    const orderGateway = new FakeCloverOrderGateway();
    const orderResult = await orderGateway.createOrder({
      localOrderId: "local-order-1",
      orderNumber: this.state.orderNumber,
      orderTypeId: "fake-delivery-order-type",
      lines: [],
      totalCents: 2_500,
      currency: "CAD",
      idempotencyKey: "local-order-1",
    });
    if (orderResult.kind !== "success") {
      throw new Error("The baseline fake Clover order must succeed.");
    }
    this.providerOrderId = orderResult.value.providerOrderId;
    this.state.audit.push("CLOVER_ORDER_CREATED");

    const paymentResult = await this.paymentGateway.createPayment({
      orderId: "local-order-1",
      providerOrderId: this.providerOrderId,
      paymentMethodToken: "fake-provider-token",
      idempotencyKey: "payment-local-order-1",
      amountCents: 2_500,
      currency: "CAD",
    });
    if (paymentResult.kind === "unknown") {
      this.state.payment = "UNKNOWN";
      this.state.exception = {
        kind: "PAYMENT_UNKNOWN",
        owner: "PAYMENT_RECONCILIATION",
        recoveryAction: "Reconcile the provider payment before printing or production.",
        ambiguous: true,
      };
      this.state.audit.push("PAYMENT_UNKNOWN");
      return this.state;
    }
    if (paymentResult.kind !== "success") {
      this.state.payment = "FAILED";
      this.state.audit.push("PAYMENT_FAILED");
      return this.state;
    }

    this.state.payment = "PAID";
    this.state.audit.push("PAYMENT_CONFIRMED", "INITIAL_PRINT_INTENT_CREATED");
    await this.submitInitialPrint();
    return this.state;
  }

  async recoverPrint(): Promise<FakeOrderFlowState> {
    if (!this.state.exception || this.state.exception.kind !== "PAID_BUT_UNPRINTED") {
      return this.state;
    }

    if (this.state.exception.ambiguous) {
      if (!this.providerOrderId) {
        throw new Error("An ambiguous print must retain its provider order correlation.");
      }
      const observation = await this.printer.reconcile({
        providerOrderId: this.providerOrderId,
        idempotencyKey: this.initialPrintIdempotencyKey,
      });
      if (observation.kind !== "success") {
        return this.state;
      }
      this.state.print = "PRINTED";
      this.state.exception = null;
      this.state.audit.push("PRINT_RECONCILED");
    } else {
      await this.submitInitialPrint();
      return this.state;
    }

    this.finishFulfillment();
    return this.state;
  }

  private async submitInitialPrint(): Promise<void> {
    if (!this.providerOrderId || this.state.payment !== "PAID") {
      throw new Error("Unpaid or provider-orderless work cannot print.");
    }

    const printResult = await this.printer.submit({
      localOrderId: "local-order-1",
      providerOrderId: this.providerOrderId,
      orderNumber: this.state.orderNumber,
      purpose: "INITIAL",
      idempotencyKey: this.initialPrintIdempotencyKey,
    });

    if (printResult.kind === "unknown") {
      this.state.print = "UNKNOWN";
      this.state.exception = {
        kind: "PAID_BUT_UNPRINTED",
        owner: "ORDER_CONTROLLER",
        recoveryAction: "Reconcile the provider event and physical printer before any reprint.",
        ambiguous: true,
      };
      this.state.audit.push("PRINT_OUTCOME_UNKNOWN");
      return;
    }

    if (printResult.kind !== "success") {
      this.state.print = "FAILED";
      this.state.exception = {
        kind: "PAID_BUT_UNPRINTED",
        owner: "ORDER_CONTROLLER",
        recoveryAction: "Retry the known-failed print intent or use the audited fallback.",
        ambiguous: false,
      };
      this.state.audit.push("PRINT_FAILED");
      return;
    }

    this.state.print = "SUBMITTED";
    this.state.audit.push("PRINT_SUBMITTED");
    const observation = await this.printer.getStatus(printResult.value.providerPrintEventId);
    if (observation.kind !== "success" || observation.value.state !== "PRINTED") {
      this.state.print = "UNKNOWN";
      this.state.exception = {
        kind: "PAID_BUT_UNPRINTED",
        owner: "ORDER_CONTROLLER",
        recoveryAction: "Reconcile the submitted print event and physical printer before production.",
        ambiguous: true,
      };
      this.state.audit.push("PRINT_OBSERVATION_UNKNOWN");
      return;
    }
    this.state.print = "PRINTED";
    this.state.exception = null;
    this.state.audit.push("PRINT_OBSERVED");
    this.finishFulfillment();
  }

  private finishFulfillment(): void {
    if (this.state.payment !== "PAID" || this.state.print !== "PRINTED") {
      return;
    }
    this.state.production = "ACCEPTED";
    this.state.audit.push("ORDER_ACCEPTED");
    this.state.production = "PREPARING";
    this.state.audit.push("PREPARATION_STARTED");
    this.state.production = "PACKED";
    this.state.audit.push("ORDER_PACKED");
    this.state.production = "AT_DISPATCH_DESK";
    this.state.audit.push("ORDER_AT_DISPATCH_DESK");
    this.state.dispatch = "ASSIGNED";
    this.state.audit.push("RUN_ASSIGNED");
    this.state.dispatch = "PICKED_UP";
    this.state.audit.push("RUN_PICKED_UP");
    this.state.dispatch = "EN_ROUTE";
    this.state.audit.push("RUN_EN_ROUTE");
    this.state.dispatch = "DELIVERED";
    this.state.audit.push("ORDER_DELIVERED");
  }
}

export function createRecoverablePrintFailureHarness(): FakeOrderFlowHarness {
  const printer = new FakeOrderPrinter(
    new DeterministicScenarioPlan({ "print.submit": ["offline", "recovery"] }),
  );
  return new FakeOrderFlowHarness(new FakePaymentGateway(), printer);
}
