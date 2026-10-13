import { randomUUID } from "node:crypto";
import { CatalogEntityType, OrderPaymentStatus, PaymentProvider, Prisma } from "@prisma/client";
import {
  buildAtomicOrderPayload,
  getCloverAtomicOrderTotal,
  type CloverAtomicOrderResponse,
} from "@/lib/clover/atomic-order";
import { CloverApiError, createCloverClient, type CloverClient } from "@/lib/clover/client";
import { db } from "@/lib/db";
import { validateCheckoutCatalogMappings } from "@/lib/orders/catalog";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class CloverOrderOutcomeUnknownError extends Error {
  constructor(public readonly externalOrderId: string) {
    super("Clover order creation outcome is unknown and requires reconciliation.");
    this.name = "CloverOrderOutcomeUnknownError";
  }
}

export class CloverOrderTotalMismatchError extends Error {}

async function recordLateCloverOrderOutcome(
  tx: Prisma.TransactionClient,
  input: { orderId: string; externalOrderId: string; providerOrderId: string; outcome: string },
) {
  await tx.operationalAlert.upsert({
    where: { alertKey: `late-clover-order-outcome:${input.externalOrderId}:${input.providerOrderId}` },
    create: { alertKey: `late-clover-order-outcome:${input.externalOrderId}:${input.providerOrderId}`, category: "EXTERNAL_ORDER_EXCEPTION", severity: "CRITICAL", entityType: "ExternalOrder", entityId: input.externalOrderId, summary: "A Clover order response arrived after the submission claim changed. Reconcile the provider order before any payment retry.", details: { providerOrderId: input.providerOrderId, outcome: input.outcome } },
    update: { status: "OPEN", severity: "CRITICAL", lastSeenAt: new Date(), resolvedAt: null, resolutionNote: null },
  });
  await tx.orderEvent.create({ data: { orderId: input.orderId, actorType: "SYSTEM", actorLabel: "Clover order outbox", eventType: "CLOVER_ORDER_LATE_OUTCOME_REQUIRES_RECONCILIATION", metadata: { externalOrderId: input.externalOrderId, providerOrderId: input.providerOrderId, outcome: input.outcome } } });
}

export async function ensureCloverExternalOrder(
  orderId: string,
  client: CloverClient = createCloverClient(),
) {
  const existing = await db.externalOrder.findUnique({
    where: { orderId_provider: { orderId, provider: PaymentProvider.CLOVER } },
  });
  if (existing?.state === "CREATED" && existing.providerOrderId) return existing;
  if (existing) {
    throw new CloverOrderOutcomeUnknownError(existing.id);
  }

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { modifiers: true }, orderBy: { sortOrder: "asc" } } },
  });
  const mappingIds = await validateCheckoutCatalogMappings(db, {
    itemIds: order.items.flatMap((item) => (item.menuItemId ? [item.menuItemId] : [])),
    modifierOptionIds: order.items.flatMap((item) =>
      item.modifiers.flatMap((modifier) => (modifier.modifierOptionId ? [modifier.modifierOptionId] : [])),
    ),
    requireDeliveryServiceCharge: order.deliveryFeeCents > 0,
  });
  const getRequired = (type: CatalogEntityType, key: string) => {
    const value = mappingIds.get(`${type}:${key}`);
    if (!value) throw new Error(`Missing verified ${type} mapping for ${key}.`);
    return value;
  };
  const config = await db.catalogConfiguration.findUniqueOrThrow({ where: { id: 1 } });
  const payload = buildAtomicOrderPayload(order, {
    orderTypeId: getRequired(CatalogEntityType.ORDER_TYPE, config.requiredOrderTypeKey),
    taxRateIds: [
      getRequired(CatalogEntityType.TAX_RATE, config.requiredGstTaxMappingKey),
      getRequired(CatalogEntityType.TAX_RATE, config.requiredQstTaxMappingKey),
    ],
    deliveryServiceChargeId: order.deliveryFeeCents > 0
      ? getRequired(CatalogEntityType.SERVICE_CHARGE, config.requiredDeliveryFeeMappingKey)
      : undefined,
    itemIds: Object.fromEntries(order.items.flatMap((item) =>
      item.menuItemId ? [[item.menuItemId, getRequired(CatalogEntityType.ITEM, item.menuItemId)]] : [],
    )),
    modifierIds: Object.fromEntries(order.items.flatMap((item) =>
      item.modifiers.flatMap((modifier) => modifier.modifierOptionId
        ? [[modifier.modifierOptionId, getRequired(CatalogEntityType.MODIFIER_OPTION, modifier.modifierOptionId)]]
        : []),
    )),
  });
  const requestKey = `clover-order:${order.id}`;
  const submissionToken = randomUUID();
  const submissionStartedAt = new Date();
  const intent = await db.$transaction(async (tx) => {
        const created = await tx.externalOrder.create({
          data: {
            orderId,
            provider: PaymentProvider.CLOVER,
            providerOrderId: null,
            state: "PENDING",
            requestKey,
            submissionToken,
            submissionStartedAt,
            sanitizedData: json({ request: payload }),
          },
        });
        await tx.orderEvent.create({ data: { orderId, actorType: "SYSTEM", actorLabel: "Clover order outbox", eventType: "CLOVER_ORDER_CREATION_STAGED", metadata: { externalOrderId: created.id, requestKey } } });
        return created;
      });
  try {
    const response = await client.post<CloverAtomicOrderResponse>(
      `/v3/merchants/${encodeURIComponent(client.config.merchantId)}/atomic_order/orders`,
      { orderCart: payload.orderCart },
      { headers: { "User-Agent": "BuffetPinDirect/1.0" } },
    );
    if (!response.id) throw new CloverApiError("Clover Atomic Order response omitted id.", 502, response);
    const providerOrderId = response.id;
    const providerTotalCents = getCloverAtomicOrderTotal(response);
    if (providerTotalCents !== payload.expectedLocalTotalCents) {
      await db.$transaction(async (tx) => {
        const changed = await tx.externalOrder.updateMany({
          where: { id: intent.id, state: "PENDING", submissionToken },
          data: { providerOrderId, state: "TOTAL_MISMATCH", submissionToken: null, sanitizedData: json({ request: payload, response }) },
        });
        if (changed.count === 1) await tx.orderEvent.create({ data: { orderId, actorType: "SYSTEM", actorLabel: "Clover order outbox", eventType: "CLOVER_ORDER_TOTAL_MISMATCH", metadata: { externalOrderId: intent.id, providerOrderId, expectedTotalCents: payload.expectedLocalTotalCents, providerTotalCents } } });
        else await recordLateCloverOrderOutcome(tx, { orderId, externalOrderId: intent.id, providerOrderId, outcome: "TOTAL_MISMATCH" });
      });
      throw new CloverOrderTotalMismatchError("Clover order total did not match the immutable local non-tip total.");
    }
    const created = await db.$transaction(async (tx) => {
      const changed = await tx.externalOrder.updateMany({
        where: { id: intent.id, state: "PENDING", submissionToken },
        data: { providerOrderId, state: "CREATED", submissionToken: null, sanitizedData: json({ request: payload, response }) },
      });
      if (changed.count !== 1) {
        await recordLateCloverOrderOutcome(tx, { orderId, externalOrderId: intent.id, providerOrderId, outcome: "CREATED" });
        return null;
      }
      await tx.orderEvent.create({ data: { orderId, actorType: "SYSTEM", actorLabel: "Clover order outbox", eventType: "CLOVER_ORDER_CREATED", metadata: { externalOrderId: intent.id, providerOrderId } } });
      return tx.externalOrder.findUniqueOrThrow({ where: { id: intent.id } });
    });
    if (!created) throw new CloverOrderOutcomeUnknownError(intent.id);
    return created;
  } catch (error) {
    if (error instanceof CloverOrderTotalMismatchError) throw error;
    const terminal =
      error instanceof CloverApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![408, 409, 429].includes(error.status);
    await db.$transaction(async (tx) => {
      const changed = await tx.externalOrder.updateMany({
        where: { id: intent.id, state: "PENDING", submissionToken },
        data: {
        state: terminal ? "FAILED" : "UNKNOWN",
        submissionToken: null,
        sanitizedData: json({ request: payload, error: error instanceof CloverApiError ? { status: error.status, response: error.responseBody } : { message: error instanceof Error ? error.message : String(error) } }),
        },
      });
      if (changed.count === 1) await tx.orderEvent.create({ data: { orderId, actorType: "SYSTEM", actorLabel: "Clover order outbox", eventType: terminal ? "CLOVER_ORDER_CREATION_FAILED" : "CLOVER_ORDER_CREATION_UNKNOWN", metadata: { externalOrderId: intent.id, error: error instanceof CloverApiError ? { status: error.status } : { message: error instanceof Error ? error.message : String(error) } } } });
    });
    if (terminal) throw error;
    throw new CloverOrderOutcomeUnknownError(intent.id);
  }
}

export async function resolveUnknownCloverOrder(input: {
  externalOrderId: string;
  providerOrderId: string;
  actorId: string;
  evidence: { verificationMethod: "CLOVER_API"; observedAt: string; note: string };
  client?: CloverClient;
}) {
  if (!input.providerOrderId.trim()) throw new Error("Provider order id is required.");
  if (input.evidence.verificationMethod !== "CLOVER_API") throw new Error("Clover API verification evidence is required.");
  if (!input.evidence.note.trim() || !Number.isFinite(Date.parse(input.evidence.observedAt))) throw new Error("Dated reconciliation evidence and a note are required.");
  const intent = await db.externalOrder.findUniqueOrThrow({ where: { id: input.externalOrderId }, include: { order: { select: { orderNumber: true, totalCents: true, tipCents: true } } } });
  if (intent.state !== "UNKNOWN") throw new Error("External order is not unresolved.");
  const client = input.client ?? createCloverClient();
  const providerOrder = await client.get<{ id?: string; total?: number; note?: string }>(`/v3/merchants/${encodeURIComponent(client.config.merchantId)}/orders/${encodeURIComponent(input.providerOrderId.trim())}`);
  if (providerOrder.id !== input.providerOrderId.trim()) throw new Error("Clover returned a different order id during reconciliation.");
  const expectedTotal = intent.order.totalCents - intent.order.tipCents;
  if (typeof providerOrder.total !== "number" || providerOrder.total !== expectedTotal) throw new Error("Clover reconciliation total does not match the immutable local non-tip total.");
  if (providerOrder.note !== `Buffet Pin delivery ${intent.order.orderNumber}`) throw new Error("Clover reconciliation note does not match the immutable operational order number.");
  return db.$transaction(async (tx) => {
    const changed = await tx.externalOrder.updateMany({
      where: { id: intent.id, state: "UNKNOWN", submissionToken: null },
      data: { providerOrderId: input.providerOrderId.trim(), state: "CREATED", sanitizedData: json({ previous: intent.sanitizedData, reconciliation: input.evidence, providerOrder }) },
    });
    if (changed.count !== 1) throw new Error("External order changed during reconciliation.");
    const updated = await tx.externalOrder.findUniqueOrThrow({ where: { id: intent.id } });
    await tx.orderEvent.create({
      data: { orderId: intent.orderId, actorType: "ADMIN", actorId: input.actorId, eventType: "CLOVER_ORDER_UNKNOWN_RESOLVED", metadata: { externalOrderId: intent.id, providerOrderId: updated.providerOrderId } },
    });
    const payment = await tx.payment.findFirst({ where: { orderId: intent.orderId, provider: PaymentProvider.CLOVER }, orderBy: { createdAt: "asc" } });
    if (payment?.status === OrderPaymentStatus.PENDING && !payment.providerPaymentId && !payment.checkoutSessionId) {
      const paymentChanged = await tx.payment.updateMany({
        where: { id: payment.id, status: OrderPaymentStatus.PENDING, providerPaymentId: null, checkoutSessionId: null },
        data: {
          status: OrderPaymentStatus.FAILED,
          failedAt: new Date(),
          failureCode: "CLOVER_ORDER_RECOVERED_UNPAID_RESTART_REQUIRED",
          failureMessage: "The Clover order was recovered, but the one-time payment source was not retained. The customer must begin a new checkout.",
        },
      });
      if (paymentChanged.count !== 1) throw new Error("Payment changed during Clover order recovery.");
      const orderChanged = await tx.order.updateMany({
        where: { id: intent.orderId, paymentStatus: OrderPaymentStatus.PENDING },
        data: { paymentStatus: OrderPaymentStatus.FAILED },
      });
      if (orderChanged.count !== 1) throw new Error("Order payment state changed during Clover order recovery.");
      await tx.orderEvent.create({
        data: {
          orderId: intent.orderId,
          actorType: "SYSTEM",
          actorLabel: "Clover order recovery",
          eventType: "CLOVER_ORDER_RECOVERED_UNPAID_CHECKOUT_RESTART_REQUIRED",
          fromPaymentStatus: OrderPaymentStatus.PENDING,
          toPaymentStatus: OrderPaymentStatus.FAILED,
          metadata: { externalOrderId: intent.id, paymentId: payment.id, providerOrderId: updated.providerOrderId },
        },
      });
    }
    return updated;
  });
}

export async function resolveCloverOrderNotCreated(input: {
  externalOrderId: string;
  actorId: string;
  actorLabel?: string;
  evidence: { verificationMethod: "CLOVER_DASHBOARD" | "CLOVER_SUPPORT"; observedAt: string; note: string };
}) {
  if (!["CLOVER_DASHBOARD", "CLOVER_SUPPORT"].includes(input.evidence.verificationMethod)) throw new Error("Clover dashboard or support evidence is required.");
  if (!input.evidence.note.trim() || !Number.isFinite(Date.parse(input.evidence.observedAt))) throw new Error("Dated reconciliation evidence and a note are required.");
  return db.$transaction(async (tx) => {
    const intent = await tx.externalOrder.findUniqueOrThrow({ where: { id: input.externalOrderId } });
    if (intent.state !== "UNKNOWN") throw new Error("External order is not awaiting reconciliation.");
    const changed = await tx.externalOrder.updateMany({ where: { id: intent.id, state: "UNKNOWN", submissionToken: null }, data: { state: "FAILED", sanitizedData: json({ previous: intent.sanitizedData, reconciliation: { outcome: "NOT_CREATED", ...input.evidence } }) } });
    if (changed.count !== 1) throw new Error("External order changed during reconciliation.");
    const updated = await tx.externalOrder.findUniqueOrThrow({ where: { id: intent.id } });
    await tx.orderEvent.create({ data: { orderId: intent.orderId, actorType: "ADMIN", actorId: input.actorId, actorLabel: input.actorLabel, eventType: "CLOVER_ORDER_RECONCILED_NOT_CREATED", message: input.evidence.note, metadata: { externalOrderId: intent.id, verificationMethod: input.evidence.verificationMethod, observedAt: input.evidence.observedAt } } });
    const payment = await tx.payment.findFirst({ where: { orderId: intent.orderId, provider: PaymentProvider.CLOVER }, orderBy: { createdAt: "asc" } });
    if (payment?.status === OrderPaymentStatus.PENDING && !payment.providerPaymentId && !payment.checkoutSessionId) {
      const paymentChanged = await tx.payment.updateMany({
        where: { id: payment.id, status: OrderPaymentStatus.PENDING, providerPaymentId: null, checkoutSessionId: null },
        data: {
          status: OrderPaymentStatus.FAILED,
          failedAt: new Date(),
          failureCode: "CLOVER_ORDER_CONFIRMED_NOT_CREATED_RESTART_REQUIRED",
          failureMessage: "Clover confirmed that the order was not created. The customer must begin a new checkout.",
        },
      });
      if (paymentChanged.count !== 1) throw new Error("Payment changed during Clover order reconciliation.");
      const orderChanged = await tx.order.updateMany({
        where: { id: intent.orderId, paymentStatus: OrderPaymentStatus.PENDING },
        data: { paymentStatus: OrderPaymentStatus.FAILED },
      });
      if (orderChanged.count !== 1) throw new Error("Order payment state changed during Clover order reconciliation.");
      await tx.orderEvent.create({
        data: {
          orderId: intent.orderId,
          actorType: "SYSTEM",
          actorLabel: "Clover order recovery",
          eventType: "CLOVER_ORDER_NOT_CREATED_CHECKOUT_RESTART_REQUIRED",
          fromPaymentStatus: OrderPaymentStatus.PENDING,
          toPaymentStatus: OrderPaymentStatus.FAILED,
          metadata: { externalOrderId: intent.id, paymentId: payment.id },
        },
      });
    }
    return updated;
  });
}

export async function abandonFailedCloverOrder(input: {
  externalOrderId: string;
  actorId: string;
  actorLabel?: string;
  reason: string;
}) {
  if (!input.reason.trim()) throw new Error("An abandonment reason is required.");
  return db.$transaction(async (tx) => {
    const intent = await tx.externalOrder.findUniqueOrThrow({ where: { id: input.externalOrderId }, include: { order: { include: { payments: true } } } });
    if (intent.state !== "FAILED") throw new Error("External order is not a known failed submission.");
    const cloverPayments = intent.order.payments.filter((payment) => payment.provider === PaymentProvider.CLOVER);
    if (cloverPayments.length === 0 || cloverPayments.some((payment) => payment.status !== OrderPaymentStatus.FAILED || payment.providerPaymentId || payment.checkoutSessionId)) {
      throw new Error("Only an unpaid checkout with no provider payment can be abandoned.");
    }
    const changed = await tx.externalOrder.updateMany({ where: { id: intent.id, state: "FAILED" }, data: { state: "ABANDONED", sanitizedData: json({ previous: intent.sanitizedData, abandonment: { reason: input.reason.trim(), actorId: input.actorId } }) } });
    if (changed.count !== 1) throw new Error("External order changed during abandonment.");
    await tx.orderEvent.create({
      data: {
        orderId: intent.orderId,
        actorType: "ADMIN",
        actorId: input.actorId,
        actorLabel: input.actorLabel,
        eventType: "CLOVER_ORDER_FAILED_CHECKOUT_ABANDONED",
        message: input.reason.trim(),
        metadata: { externalOrderId: intent.id, customerMustRestartCheckout: true },
      },
    });
    return tx.externalOrder.findUniqueOrThrow({ where: { id: intent.id } });
  });
}
