export type ProviderScenario =
  | "success"
  | "terminal_failure"
  | "transient_failure"
  | "timeout"
  | "unknown"
  | "duplicate"
  | "offline"
  | "recovery";

export type ProviderError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ProviderResult<T> =
  | { kind: "success"; value: T; attempt: number; recovered: boolean }
  | { kind: "terminal_failure"; error: ProviderError; attempt: number }
  | { kind: "transient_failure"; error: ProviderError; attempt: number }
  | { kind: "unknown"; error: ProviderError; attempt: number }
  | { kind: "duplicate"; value?: T; attempt: number };

export type Money = {
  amountCents: number;
  currency: "CAD" | "USD";
};

export type PaymentRequest = Money & {
  orderId: string;
  providerOrderId: string;
  paymentMethodToken: string;
  idempotencyKey: string;
};

export type PaymentEvidence = Money & {
  providerPaymentId: string;
  providerOrderId: string;
  paid: boolean;
};

export type VerifiedPaymentEvent = {
  providerEventId: string;
  providerPaymentId: string;
  providerOrderId: string;
  paid: boolean;
};

export type RefundRequest = Money & {
  orderId: string;
  providerPaymentId: string;
  idempotencyKey: string;
  reason: string;
};

export type RefundEvidence = Money & {
  providerRefundId: string;
  providerPaymentId: string;
};

export interface PaymentGateway {
  createPayment(input: PaymentRequest): Promise<ProviderResult<PaymentEvidence>>;
  reconcile(event: VerifiedPaymentEvent): Promise<ProviderResult<PaymentEvidence>>;
  refund(input: RefundRequest): Promise<ProviderResult<RefundEvidence>>;
}

export type ProviderOrderLine = {
  localItemId: string;
  providerItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  modifiers: Array<{
    providerModifierId: string;
    name: string;
    priceDeltaCents: number;
  }>;
  instructions?: string;
};

export type ProviderOrderRequest = {
  localOrderId: string;
  orderNumber: string;
  orderTypeId: string;
  lines: ProviderOrderLine[];
  totalCents: number;
  currency: "CAD" | "USD";
  idempotencyKey: string;
};

export type ProviderOrderEvidence = {
  providerOrderId: string;
  orderNumber: string;
  totalCents: number;
  currency: "CAD" | "USD";
};

export interface CloverOrderGateway {
  createOrder(input: ProviderOrderRequest): Promise<ProviderResult<ProviderOrderEvidence>>;
  getOrder(providerOrderId: string): Promise<ProviderResult<ProviderOrderEvidence>>;
}

export type PrintRequest = {
  localOrderId: string;
  providerOrderId: string;
  orderNumber: string;
  purpose: "INITIAL" | "REPRINT";
  idempotencyKey: string;
  reprintReason?: string;
};

export type PrintEvidence = {
  providerPrintEventId: string;
  providerOrderId: string;
  state: "SUBMITTED" | "PRINTING" | "PRINTED" | "FAILED" | "UNKNOWN";
};

export type PrintReconciliationRequest = {
  providerOrderId: string;
  idempotencyKey: string;
};

export interface OrderPrinter {
  submit(input: PrintRequest): Promise<ProviderResult<PrintEvidence>>;
  getStatus(providerPrintEventId: string): Promise<ProviderResult<PrintEvidence>>;
  reconcile(input: PrintReconciliationRequest): Promise<ProviderResult<PrintEvidence>>;
}

export type RoutePoint = {
  id: string;
  latitude: number;
  longitude: number;
};

export type RouteMatrix = {
  durationsSeconds: number[][];
  distancesMeters: number[][];
};

export type OrderedRoute = {
  orderedStopIds: string[];
  durationSeconds: number;
  distanceMeters: number;
};

export interface RoutingProvider {
  computeMatrix(points: RoutePoint[]): Promise<ProviderResult<RouteMatrix>>;
  orderStops(origin: RoutePoint, stops: RoutePoint[]): Promise<ProviderResult<OrderedRoute>>;
}

export type NotificationRequest = {
  intentId: string;
  recipient: string;
  templateKey: string;
  body: string;
};

export type NotificationEvidence = {
  providerMessageId: string;
  status: "QUEUED" | "SENT" | "DELIVERED";
};

export interface NotificationProvider {
  send(input: NotificationRequest): Promise<ProviderResult<NotificationEvidence>>;
}

export type GeocodeRequest = {
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

export type GeocodeEvidence = {
  providerPlaceId: string;
  normalizedAddress: string;
  latitude: number;
  longitude: number;
};

export interface GeocodingProvider {
  geocode(input: GeocodeRequest): Promise<ProviderResult<GeocodeEvidence>>;
}
