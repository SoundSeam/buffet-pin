import { OrderPaymentStatus, OrderServiceType, PaymentProvider, PrismaClient, RefundIntentStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { refundPaidOrder, resolveRefundIntent } from "../../lib/orders/refunds";
import { createOrderIdentity } from "../../lib/orders/identity";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";

const prisma = new PrismaClient({ datasourceUrl: assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL) });
let customerId: string;

async function paidOrder() {
  const identity = await createOrderIdentity(prisma);
  return prisma.order.create({ data: {
    ...identity, publicCode: `M8${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`, serviceType: OrderServiceType.DELIVERY,
    paymentStatus: OrderPaymentStatus.PAID, customerId, customerName: "M8 Customer", customerPhone: "+15555550800",
    itemsSubtotalCents: 1000, taxableSubtotalCents: 1000, gstCents: 50, qstCents: 100, taxCents: 150, totalCents: 1150,
    payments: { create: { provider: PaymentProvider.CLOVER, status: OrderPaymentStatus.PAID, amountCents: 1150, currency: "CAD", providerPaymentId: `charge-${crypto.randomUUID()}`, providerOrderId: `order-${crypto.randomUUID()}`, paidAt: new Date() } },
  } });
}

beforeAll(async () => { customerId = (await prisma.customer.create({ data: { name: "M8 Customer", phone: `+1555${Date.now().toString().slice(-7)}` } })).id; });
afterAll(() => prisma.$disconnect());

describe("M8 durable refund coordination", () => {
  it("creates one intent and one refund for duplicate requests", async () => {
    const order = await paidOrder();
    const provider = vi.fn().mockImplementation(async ({ payment, amountCents, idempotencyKey }) => ({ state: "succeeded", providerOperation: "refund", succeeded: true, partial: false, pending: false, unknown: false, failed: false, providerRefundId: `refund-${order.id}`, providerPaymentId: payment.providerPaymentId, providerOrderId: payment.providerOrderId, idempotencyKey, amountCents, errorCode: null, rawResponse: { id: `refund-${order.id}`, amount: amountCents } }));
    const input = { orderId: order.id, requestKey: `refund-${order.id}`, reason: "Customer cancellation", actorId: "manager-m8", provider };
    const results = await Promise.all(Array.from({ length: 4 }, () => refundPaidOrder(input)));
    expect(results.some((result) => result.intent.status === RefundIntentStatus.SUCCEEDED)).toBe(true);
    expect(results.filter((result) => result.replayed)).toHaveLength(3);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(await prisma.refundIntent.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("fails closed on partial refunds and persists ambiguous provider outcomes", async () => {
    const partial = await paidOrder();
    await expect(refundPaidOrder({ orderId: partial.id, requestKey: `partial-${partial.id}`, reason: "Partial", amountCents: 500, actorId: "manager-m8" })).rejects.toMatchObject({ code: "PARTIAL_REFUNDS_DISABLED" });
    const unknown = await paidOrder();
    const provider = vi.fn().mockImplementation(async ({ payment, amountCents, idempotencyKey }) => ({ state: "unknown", providerOperation: "refund", succeeded: false, partial: false, pending: true, unknown: true, failed: false, providerRefundId: null, providerPaymentId: payment.providerPaymentId, providerOrderId: payment.providerOrderId, idempotencyKey, amountCents, errorCode: "TRANSPORT_UNKNOWN", rawResponse: { message: "timeout" } }));
    const result = await refundPaidOrder({ orderId: unknown.id, requestKey: `unknown-${unknown.id}`, reason: "Cancel", actorId: "manager-m8", provider });
    expect(result.intent.status).toBe(RefundIntentStatus.UNKNOWN);
    expect(result.order.paymentStatus).toBe(OrderPaymentStatus.PAID);
  });

  it("reserves the aggregate remaining balance across different concurrent keys", async () => {
    const order = await paidOrder();
    const provider = vi.fn().mockImplementation(async ({ payment, amountCents, idempotencyKey }) => ({ state: "succeeded", providerOperation: "refund", succeeded: true, partial: false, pending: false, unknown: false, failed: false, providerRefundId: `refund-${idempotencyKey}`, providerPaymentId: payment.providerPaymentId, providerOrderId: payment.providerOrderId, idempotencyKey, amountCents, errorCode: null, rawResponse: { amount: amountCents } }));
    const results = await Promise.allSettled(["a", "b", "c"].map((key) => refundPaidOrder({ orderId: order.id, requestKey: `different-${key}-${order.id}`, reason: "Full cancellation", actorId: "manager-m8", provider })));
    expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(await prisma.refundIntent.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("uses CAS for concurrent manual resolution and never double-counts", async () => {
    const order = await paidOrder();
    const unknownProvider = vi.fn().mockImplementation(async ({ payment, amountCents, idempotencyKey }) => ({ state: "unknown", providerOperation: "refund", succeeded: false, partial: false, pending: true, unknown: true, failed: false, providerRefundId: null, providerPaymentId: payment.providerPaymentId, providerOrderId: payment.providerOrderId, idempotencyKey, amountCents, errorCode: "TIMEOUT", rawResponse: {} }));
    const unknown = await refundPaidOrder({ orderId: order.id, requestKey: `manual-${order.id}`, reason: "Cancel", actorId: "manager-m8", provider: unknownProvider });
    const resolutions = await Promise.allSettled(Array.from({ length: 4 }, (_, index) => resolveRefundIntent({ intentId: unknown.intent.id, succeeded: true, providerRefundId: `provider-refund-${index}`, reason: "Confirmed in Clover", actorId: "manager-m8" })));
    expect(resolutions.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.refundedAmountCents).toBe(payment.amountCents);
    expect(await prisma.refundIntent.count({ where: { orderId: order.id, status: RefundIntentStatus.SUCCEEDED } })).toBe(1);
  });

  it("persists a review-required intent when a paid legacy order lacks a Clover charge id", async () => {
    const order = await paidOrder();
    await prisma.payment.updateMany({ where: { orderId: order.id }, data: { providerPaymentId: null } });
    const result = await refundPaidOrder({ orderId: order.id, requestKey: `missing-charge-${order.id}`, reason: "Paid rejection", actorId: "manager-m8" });
    expect(result.intent.status).toBe(RefundIntentStatus.REQUIRES_REVIEW);
    expect(result.refund).toBeNull();
  });

  it("adds successful intent totals without losing pre-ledger refund evidence", async () => {
    await prisma.restaurantOrderSettings.upsert({ where: { id: 1 }, create: { id: 1, partialRefundsEnabled: true }, update: { partialRefundsEnabled: true } });
    const order = await paidOrder();
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    await prisma.payment.update({ where: { id: payment.id }, data: { refundedAmountCents: 400, status: OrderPaymentStatus.PARTIALLY_REFUNDED } });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED } });
    const provider = vi.fn().mockImplementation(async ({ payment: current, amountCents, idempotencyKey }) => ({ state: "succeeded", providerOperation: "refund", succeeded: true, partial: false, pending: false, unknown: false, failed: false, providerRefundId: `refund-${idempotencyKey}`, providerPaymentId: current.providerPaymentId, providerOrderId: current.providerOrderId, idempotencyKey, amountCents, errorCode: null, rawResponse: { amount: amountCents } }));
    await refundPaidOrder({ orderId: order.id, requestKey: `legacy-remainder-${order.id}`, reason: "Refund remaining balance", actorId: "manager-m8", provider });
    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.refundedAmountCents).toBe(stored.amountCents);
    expect(stored.status).toBe(OrderPaymentStatus.REFUNDED);
  });
});
