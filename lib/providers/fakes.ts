import type {
  CloverOrderGateway,
  GeocodeEvidence,
  GeocodeRequest,
  GeocodingProvider,
  NotificationEvidence,
  NotificationProvider,
  NotificationRequest,
  OrderPrinter,
  OrderedRoute,
  PaymentEvidence,
  PaymentGateway,
  PaymentRequest,
  PrintEvidence,
  PrintReconciliationRequest,
  PrintRequest,
  ProviderOrderEvidence,
  ProviderOrderRequest,
  ProviderResult,
  ProviderScenario,
  RefundEvidence,
  RefundRequest,
  RouteMatrix,
  RoutePoint,
  RoutingProvider,
  VerifiedPaymentEvent,
} from "./contracts";

type OperationPlan = Record<string, ProviderScenario[]>;

export class DeterministicScenarioPlan {
  private readonly scenarios = new Map<string, ProviderScenario[]>();
  private readonly attempts = new Map<string, number>();

  constructor(plan: Partial<OperationPlan> = {}) {
    for (const [operation, scenarios] of Object.entries(plan)) {
      if (scenarios) {
        this.scenarios.set(operation, [...scenarios]);
      }
    }
  }

  next(operation: string): { scenario: ProviderScenario; attempt: number } {
    const attempt = (this.attempts.get(operation) ?? 0) + 1;
    this.attempts.set(operation, attempt);
    const scenarios = this.scenarios.get(operation);
    return { scenario: scenarios?.shift() ?? "success", attempt };
  }
}

function resolveScenario<T>(
  scenarioPlan: DeterministicScenarioPlan,
  operation: string,
  value: () => T,
): ProviderResult<T> {
  const { scenario, attempt } = scenarioPlan.next(operation);

  if (scenario === "success" || scenario === "recovery") {
    return { kind: "success", value: value(), attempt, recovered: scenario === "recovery" };
  }

  if (scenario === "duplicate") {
    return { kind: "duplicate", value: value(), attempt };
  }

  if (scenario === "timeout" || scenario === "unknown") {
    return {
      kind: "unknown",
      attempt,
      error: {
        code: scenario === "timeout" ? "PROVIDER_TIMEOUT" : "PROVIDER_OUTCOME_UNKNOWN",
        message: "The provider outcome is unknown and requires reconciliation.",
        retryable: false,
      },
    };
  }

  if (scenario === "transient_failure" || scenario === "offline") {
    return {
      kind: "transient_failure",
      attempt,
      error: {
        code: scenario === "offline" ? "PROVIDER_OFFLINE" : "PROVIDER_TRANSIENT_FAILURE",
        message: "The provider is temporarily unavailable.",
        retryable: true,
      },
    };
  }

  return {
    kind: "terminal_failure",
    attempt,
    error: {
      code: "PROVIDER_TERMINAL_FAILURE",
      message: "The provider rejected the request permanently.",
      retryable: false,
    },
  };
}

export class FakePaymentGateway implements PaymentGateway {
  private readonly payments = new Map<string, PaymentEvidence>();
  private readonly events = new Map<string, PaymentEvidence>();
  private readonly terminalEventIds = new Set<string>();
  private readonly refunds = new Map<string, RefundEvidence>();

  constructor(private readonly plan = new DeterministicScenarioPlan()) {}

  async createPayment(input: PaymentRequest): Promise<ProviderResult<PaymentEvidence>> {
    const existing = this.payments.get(input.idempotencyKey);
    if (existing) {
      return { kind: "duplicate", value: existing, attempt: 1 };
    }
    const result = resolveScenario(this.plan, "payment.create", () => ({
      providerPaymentId: `fake-payment-${input.idempotencyKey}`,
      providerOrderId: input.providerOrderId,
      paid: true,
      amountCents: input.amountCents,
      currency: input.currency,
    }));
    if (result.kind === "success") {
      this.payments.set(input.idempotencyKey, result.value);
    }
    return result;
  }

  async reconcile(event: VerifiedPaymentEvent): Promise<ProviderResult<PaymentEvidence>> {
    const existing = this.events.get(event.providerEventId);
    if (existing || this.terminalEventIds.has(event.providerEventId)) {
      return { kind: "duplicate", value: existing, attempt: 1 };
    }

    const result = resolveScenario(this.plan, "payment.reconcile", () => ({
      providerPaymentId: event.providerPaymentId,
      providerOrderId: event.providerOrderId,
      paid: event.paid,
      amountCents: 0,
      currency: "CAD" as const,
    }));
    if (result.kind === "success") {
      this.events.set(event.providerEventId, result.value);
    } else if (result.kind === "terminal_failure") {
      this.terminalEventIds.add(event.providerEventId);
    }
    return result;
  }

  async refund(input: RefundRequest): Promise<ProviderResult<RefundEvidence>> {
    const existing = this.refunds.get(input.idempotencyKey);
    if (existing) {
      return { kind: "duplicate", value: existing, attempt: 1 };
    }
    const result = resolveScenario(this.plan, "payment.refund", () => ({
      providerRefundId: `fake-refund-${input.idempotencyKey}`,
      providerPaymentId: input.providerPaymentId,
      amountCents: input.amountCents,
      currency: input.currency,
    }));
    if (result.kind === "success") {
      this.refunds.set(input.idempotencyKey, result.value);
    }
    return result;
  }
}

export class FakeCloverOrderGateway implements CloverOrderGateway {
  private readonly orders = new Map<string, ProviderOrderEvidence>();
  private readonly idempotencyKeys = new Map<string, ProviderOrderEvidence>();

  constructor(private readonly plan = new DeterministicScenarioPlan()) {}

  async createOrder(input: ProviderOrderRequest): Promise<ProviderResult<ProviderOrderEvidence>> {
    const existing = this.idempotencyKeys.get(input.idempotencyKey);
    if (existing) {
      return { kind: "duplicate", value: existing, attempt: 1 };
    }
    const result = resolveScenario(this.plan, "cloverOrder.create", () => {
      const evidence = {
        providerOrderId: `fake-order-${input.idempotencyKey}`,
        orderNumber: input.orderNumber,
        totalCents: input.totalCents,
        currency: input.currency,
      } satisfies ProviderOrderEvidence;
      this.orders.set(evidence.providerOrderId, evidence);
      return evidence;
    });
    if (result.kind === "success") {
      this.idempotencyKeys.set(input.idempotencyKey, result.value);
    }
    return result;
  }

  async getOrder(providerOrderId: string): Promise<ProviderResult<ProviderOrderEvidence>> {
    return resolveScenario(this.plan, "cloverOrder.get", () => {
      const evidence = this.orders.get(providerOrderId);
      if (!evidence) {
        throw new Error(`Unknown fake provider order ${providerOrderId}.`);
      }
      return evidence;
    });
  }
}

export class FakeOrderPrinter implements OrderPrinter {
  private readonly events = new Map<string, PrintEvidence>();
  private readonly idempotencyKeys = new Map<string, PrintEvidence | null>();

  constructor(private readonly plan = new DeterministicScenarioPlan()) {}

  async submit(input: PrintRequest): Promise<ProviderResult<PrintEvidence>> {
    if (this.idempotencyKeys.has(input.idempotencyKey)) {
      const existing = this.idempotencyKeys.get(input.idempotencyKey) ?? undefined;
      return { kind: "duplicate", value: existing, attempt: 1 };
    }
    const result = resolveScenario(this.plan, "print.submit", () => {
      const evidence = {
        providerPrintEventId: `fake-print-${input.idempotencyKey}`,
        providerOrderId: input.providerOrderId,
        state: "SUBMITTED",
      } satisfies PrintEvidence;
      this.events.set(evidence.providerPrintEventId, evidence);
      return evidence;
    });
    if (result.kind === "success") {
      this.idempotencyKeys.set(input.idempotencyKey, result.value);
    } else if (result.kind === "unknown") {
      this.idempotencyKeys.set(input.idempotencyKey, null);
    }
    return result;
  }

  async getStatus(providerPrintEventId: string): Promise<ProviderResult<PrintEvidence>> {
    const existing = this.events.get(providerPrintEventId);
    if (!existing) {
      return {
        kind: "unknown",
        attempt: 1,
        error: {
          code: "PRINT_EVENT_NOT_OBSERVED",
          message: "The print event is not observable and its outcome remains unknown.",
          retryable: false,
        },
      };
    }
    return resolveScenario(this.plan, "print.status", () => ({
      ...existing,
      state: "PRINTED",
    }));
  }

  async reconcile(input: PrintReconciliationRequest): Promise<ProviderResult<PrintEvidence>> {
    return resolveScenario(this.plan, "print.reconcile", () => {
      const evidence = {
        providerPrintEventId: `fake-print-${input.idempotencyKey}`,
        providerOrderId: input.providerOrderId,
        state: "PRINTED",
      } satisfies PrintEvidence;
      this.events.set(evidence.providerPrintEventId, evidence);
      this.idempotencyKeys.set(input.idempotencyKey, evidence);
      return evidence;
    });
  }
}

export class FakeRoutingProvider implements RoutingProvider {
  constructor(private readonly plan = new DeterministicScenarioPlan()) {}

  async computeMatrix(points: RoutePoint[]): Promise<ProviderResult<RouteMatrix>> {
    return resolveScenario(this.plan, "routing.matrix", () => ({
      durationsSeconds: points.map((_, origin) =>
        points.map((__, destination) => Math.abs(origin - destination) * 300),
      ),
      distancesMeters: points.map((_, origin) =>
        points.map((__, destination) => Math.abs(origin - destination) * 1_000),
      ),
    }));
  }

  async orderStops(origin: RoutePoint, stops: RoutePoint[]): Promise<ProviderResult<OrderedRoute>> {
    return resolveScenario(this.plan, "routing.orderStops", () => ({
      orderedStopIds: [...stops].sort((a, b) => a.id.localeCompare(b.id)).map((stop) => stop.id),
      durationSeconds: Math.max(stops.length, 1) * 300,
      distanceMeters: Math.max(stops.length, 1) * 1_000,
    }));
  }
}

export class FakeNotificationProvider implements NotificationProvider {
  private readonly intents = new Map<string, NotificationEvidence>();

  constructor(private readonly plan = new DeterministicScenarioPlan()) {}

  async send(input: NotificationRequest): Promise<ProviderResult<NotificationEvidence>> {
    const existing = this.intents.get(input.intentId);
    if (existing) {
      return { kind: "duplicate", value: existing, attempt: 1 };
    }

    return resolveScenario(this.plan, "notification.send", () => {
      const evidence = {
        providerMessageId: `fake-message-${input.intentId}`,
        status: "SENT",
      } satisfies NotificationEvidence;
      this.intents.set(input.intentId, evidence);
      return evidence;
    });
  }
}

export class FakeGeocodingProvider implements GeocodingProvider {
  constructor(private readonly plan = new DeterministicScenarioPlan()) {}

  async geocode(input: GeocodeRequest): Promise<ProviderResult<GeocodeEvidence>> {
    return resolveScenario(this.plan, "geocoding.geocode", () => ({
      providerPlaceId: `fake-place-${input.postalCode.replace(/\s/g, "").toLowerCase()}`,
      normalizedAddress: `${input.addressLine1}, ${input.city}, ${input.province} ${input.postalCode}`,
      latitude: 45.5019,
      longitude: -73.5674,
    }));
  }
}
