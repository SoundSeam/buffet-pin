import {
  OrderActorType,
  OrderPaymentStatus,
  OrderFulfillmentStatus,
  OrderProductionStatus,
  OrderServiceType,
  PrismaClient,
  PrintJobPurpose,
  PrintJobStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrderIdentity } from "../../lib/orders/identity";
import { confirmFallbackPrint, confirmReprintPrinted, createFallbackPrintIntent, createReprintIntent } from "../../lib/orders/print-jobs";
import { confirmOrderPrinted } from "../../lib/clover/print-orders";
import { transitionProduction, verifyPackingItem } from "../../lib/orders/production";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";

const prisma = new PrismaClient({ datasourceUrl: assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL) });
let customerId: string;
const actor = { id: "operator-m4", label: "M4 Operator" };

async function order(paid = true) {
  const identity = await createOrderIdentity(prisma);
  return prisma.order.create({
    data: {
      ...identity,
      publicCode: `M4${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
      serviceType: OrderServiceType.DELIVERY,
      paymentStatus: paid ? OrderPaymentStatus.PAID : OrderPaymentStatus.PENDING,
      customerId,
      customerName: "M4 Customer",
      customerPhone: "+15555550400",
      itemsSubtotalCents: 1000,
      taxableSubtotalCents: 1000,
      taxCents: 150,
      totalCents: 1150,
      items: { create: [
        { menuItemNameSnapshot: "Plate", quantity: 2, unitPriceCents: 500, lineSubtotalCents: 1000, specialInstructions: "No onion" },
        { menuItemNameSnapshot: "Drink", quantity: 1, unitPriceCents: 0, lineSubtotalCents: 0 },
      ] },
    },
    include: { items: true },
  });
}

beforeAll(async () => {
  const customer = await prisma.customer.create({ data: { name: "M4 Customer", phone: `+1555${Date.now().toString().slice(-7)}` } });
  customerId = customer.id;
});
afterAll(() => prisma.$disconnect());

describe("M4 production and packing", () => {
  it("requires paid and confirmed print, verifies every item, and separates desk placement", async () => {
    const value = await order();
    await expect(transitionProduction(prisma, { orderId: value.id, expected: OrderProductionStatus.AWAITING_ACCEPTANCE, next: OrderProductionStatus.ACCEPTED, actor })).rejects.toMatchObject({ code: "PRINT_NOT_CONFIRMED" });
    await prisma.printJob.create({ data: { orderId: value.id, initialForOrderId: value.id, purpose: PrintJobPurpose.INITIAL, status: PrintJobStatus.PRINTED, idempotencyKey: `m4:${value.id}`, requestedByActorType: OrderActorType.SYSTEM } });
    await transitionProduction(prisma, { orderId: value.id, expected: OrderProductionStatus.AWAITING_ACCEPTANCE, next: OrderProductionStatus.ACCEPTED, actor });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: value.id } })).fulfillmentStatus).toBe(OrderFulfillmentStatus.ACCEPTED);
    await transitionProduction(prisma, { orderId: value.id, expected: OrderProductionStatus.ACCEPTED, next: OrderProductionStatus.PREPARING, actor });
    await transitionProduction(prisma, { orderId: value.id, expected: OrderProductionStatus.PREPARING, next: OrderProductionStatus.PACKING, actor });
    await expect(verifyPackingItem(prisma, { orderId: value.id, orderItemId: value.items[0]!.id, quantity: 2, instructionsAcknowledged: false, actor })).rejects.toMatchObject({ code: "PACKING_MISMATCH" });
    for (const item of value.items) {
      await verifyPackingItem(prisma, { orderId: value.id, orderItemId: item.id, quantity: item.quantity, instructionsAcknowledged: true, actor });
    }
    const packed = await transitionProduction(prisma, { orderId: value.id, expected: OrderProductionStatus.PACKING, next: OrderProductionStatus.PACKED, actor });
    expect(packed.packedAt).not.toBeNull();
    expect(packed.atDispatchDeskAt).toBeNull();
    const desk = await transitionProduction(prisma, { orderId: value.id, expected: OrderProductionStatus.PACKED, next: OrderProductionStatus.AT_DISPATCH_DESK, actor });
    expect(desk.atDispatchDeskAt).not.toBeNull();
    expect(desk.fulfillmentStatus).toBe(OrderFulfillmentStatus.READY_FOR_PICKUP);
  });

  it("rejects unpaid and concurrent stale actions", async () => {
    const unpaid = await order(false);
    await expect(transitionProduction(prisma, { orderId: unpaid.id, expected: OrderProductionStatus.AWAITING_ACCEPTANCE, next: OrderProductionStatus.CANCELLED, actor })).rejects.toMatchObject({ code: "ORDER_NOT_PAID" });
    const paid = await order();
    await prisma.printJob.create({ data: { orderId: paid.id, initialForOrderId: paid.id, purpose: PrintJobPurpose.INITIAL, status: PrintJobStatus.PRINTED, idempotencyKey: `m4:${paid.id}`, requestedByActorType: OrderActorType.SYSTEM } });
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => transitionProduction(prisma, { orderId: paid.id, expected: OrderProductionStatus.AWAITING_ACCEPTANCE, next: OrderProductionStatus.ACCEPTED, actor })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  it("requires an initial print exception and explicit physical fallback confirmation", async () => {
    const value = await order();
    const initial = await prisma.printJob.create({ data: { orderId: value.id, initialForOrderId: value.id, purpose: PrintJobPurpose.INITIAL, status: PrintJobStatus.SUBMITTED, idempotencyKey: `m4:fallback:${value.id}`, requestedByActorType: OrderActorType.SYSTEM } });
    const input = { orderId: value.id, reason: "Clover event is unresolved", requestKey: crypto.randomUUID(), actor: { actorType: OrderActorType.ADMIN, actorId: actor.id, actorLabel: actor.label } };
    await expect(createFallbackPrintIntent(prisma, input)).rejects.toThrow("only available");
    await prisma.printJob.update({ where: { id: initial.id }, data: { status: PrintJobStatus.UNKNOWN } });
    const fallbacks = await Promise.all(Array.from({ length: 4 }, () => createFallbackPrintIntent(prisma, { ...input, requestKey: crypto.randomUUID() })));
    expect(new Set(fallbacks.map((job) => job.id)).size).toBe(1);
    await expect(transitionProduction(prisma, { orderId: value.id, expected: OrderProductionStatus.AWAITING_ACCEPTANCE, next: OrderProductionStatus.ACCEPTED, actor })).rejects.toMatchObject({ code: "PRINT_NOT_CONFIRMED" });
    const confirmations = await Promise.all(Array.from({ length: 4 }, () => confirmFallbackPrint(prisma, { jobId: fallbacks[0]!.id, reason: "Labelled fallback physically emerged from printer", actor: input.actor })));
    expect(confirmations.every((job) => job.status === PrintJobStatus.PRINTED)).toBe(true);
    expect(await prisma.orderEvent.count({ where: { orderId: value.id, eventType: "BROWSER_FALLBACK_PRINT_CONFIRMED" } })).toBe(1);
    expect((await prisma.printJob.findUniqueOrThrow({ where: { id: initial.id } })).status).toBe(PrintJobStatus.UNKNOWN);
    await transitionProduction(prisma, { orderId: value.id, expected: OrderProductionStatus.AWAITING_ACCEPTANCE, next: OrderProductionStatus.ACCEPTED, actor });
  });

  it("requires a confirmed original and labelled physical confirmation for reprints", async () => {
    const value = await order();
    const actorInput = { actorType: OrderActorType.ADMIN, actorId: actor.id, actorLabel: actor.label };
    await expect(createReprintIntent(prisma, { orderId: value.id, reason: "Damaged ticket", requestKey: crypto.randomUUID(), actor: actorInput })).rejects.toThrow("previously confirmed");
    await prisma.printJob.create({ data: { orderId: value.id, initialForOrderId: value.id, purpose: PrintJobPurpose.INITIAL, status: PrintJobStatus.PRINTED, idempotencyKey: `m4:reprint-initial:${value.id}`, requestedByActorType: OrderActorType.SYSTEM } });
    const job = await createReprintIntent(prisma, { orderId: value.id, reason: "Damaged ticket", requestKey: crypto.randomUUID(), actor: actorInput });
    expect(job).toMatchObject({ purpose: PrintJobPurpose.REPRINT, status: PrintJobStatus.PENDING, reason: "Damaged ticket" });
    const confirmed = await confirmReprintPrinted(prisma, { jobId: job.id, reason: "Labelled reprint physically emerged", actor: actorInput });
    expect(confirmed.status).toBe(PrintJobStatus.PRINTED);
    expect(await prisma.orderEvent.count({ where: { orderId: value.id, eventType: "LABELLED_REPRINT_PHYSICALLY_CONFIRMED" } })).toBe(1);
  });

  it("raises a durable duplicate-ticket risk when Clover confirms after fallback", async () => {
    const value = await order();
    const providerOrderId = `clover-${crypto.randomUUID()}`;
    await prisma.externalOrder.create({ data: { orderId: value.id, provider: "CLOVER", providerOrderId, state: "CREATED", requestKey: `m4:external:${value.id}` } });
    await prisma.printJob.createMany({ data: [
      { orderId: value.id, initialForOrderId: value.id, purpose: PrintJobPurpose.INITIAL, status: PrintJobStatus.UNKNOWN, idempotencyKey: `m4:late-initial:${value.id}`, requestedByActorType: OrderActorType.SYSTEM },
      { orderId: value.id, purpose: PrintJobPurpose.FALLBACK, status: PrintJobStatus.PRINTED, idempotencyKey: `m4:late-fallback:${value.id}`, reason: "Initial print outcome was unknown", requestedByActorType: OrderActorType.ADMIN },
    ] });
    await confirmOrderPrinted(providerOrderId, { lineItemsPrinted: true });
    expect(await prisma.operationalAlert.findUnique({ where: { alertKey: `duplicate-ticket-risk:${value.id}` } })).toMatchObject({ category: "DUPLICATE_TICKET_RISK", status: "OPEN" });
  });
});
