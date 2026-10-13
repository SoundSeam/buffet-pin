import {
  OrderActorType,
  OrderPaymentStatus,
  OrderServiceType,
  PrintJobStatus,
  PrismaClient,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrderIdentity, allocateOperationalOrderNumber } from "../../lib/orders/identity";
import { createReprintIntent, ensureInitialPrintIntent } from "../../lib/orders/print-jobs";
import { confirmPayment, failPendingPayment } from "../../lib/orders/payment-state";
import { addStopToDraftRun, createDraftRun } from "../../lib/orders/runs";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";

const databaseUrl = assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const suffix = Date.now().toString(36);
let customerId: string;

async function createOrder(
  index: number,
  paymentStatus: OrderPaymentStatus = OrderPaymentStatus.PAID,
) {
  const identity = await createOrderIdentity(prisma, new Date("2026-07-22T16:00:00.000Z"));
  return prisma.order.create({
    data: {
      publicCode: `PUBLIC${suffix}${index}`.toUpperCase(),
      ...identity,
      serviceType: OrderServiceType.DELIVERY,
      paymentStatus,
      customerId,
      customerName: "Synthetic Customer",
      customerPhone: "+15555550100",
      deliveryZoneIdSnapshot: "zone-east",
      deliveryZoneNameSnapshot: "East",
      itemsSubtotalCents: 1_000,
      taxableSubtotalCents: 1_000,
      taxCents: 150,
      totalCents: 1_150,
    },
  });
}

beforeAll(async () => {
  const customer = await prisma.customer.create({
    data: { name: "Synthetic Customer", phone: `+1555${suffix.slice(-7).padStart(7, "0")}` },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("M1 database invariants", () => {
  it("allocates unique, sequential, human-readable numbers separately from tracking tokens", async () => {
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () =>
        allocateOperationalOrderNumber(prisma, new Date("2026-07-23T01:00:00.000Z")),
      ),
    );
    expect(new Set(numbers).size).toBe(20);
    expect(numbers.every((number) => /^BP-260722-\d{4}$/.test(number))).toBe(true);
    const identity = await createOrderIdentity(prisma, new Date("2026-07-23T01:00:00.000Z"));
    expect(identity.trackingToken).not.toBe(identity.orderNumber);
    const order = await createOrder(99);
    await expect(
      prisma.order.update({ where: { id: order.id }, data: { orderNumber: "BP-260722-9999" } }),
    ).rejects.toThrow("order identity is immutable");
  });

  it("creates exactly one initial print intent under concurrency and rejects unpaid work", async () => {
    const paid = await createOrder(100);
    const jobs = await Promise.all(
      Array.from({ length: 12 }, () => ensureInitialPrintIntent(prisma, paid.id)),
    );
    expect(new Set(jobs.map((job) => job.id)).size).toBe(1);
    expect(await prisma.printJob.count({ where: { initialForOrderId: paid.id } })).toBe(1);
    expect(
      await prisma.orderEvent.count({
        where: { orderId: paid.id, eventType: "INITIAL_PRINT_INTENT_CREATED" },
      }),
    ).toBe(1);

    const unpaid = await createOrder(101, OrderPaymentStatus.PENDING);
    await expect(ensureInitialPrintIntent(prisma, unpaid.id)).rejects.toThrow(
      "requires confirmed payment",
    );
  });

  it("never lets a concurrent failure downgrade confirmed payment", async () => {
    const order = await createOrder(104, OrderPaymentStatus.PENDING);
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "CLOVER",
        status: OrderPaymentStatus.PENDING,
        amountCents: order.totalCents,
        currency: order.currency,
      },
    });
    await Promise.allSettled([
      ...Array.from({ length: 6 }, () => failPendingPayment(prisma, order.id, payment.id)),
      ...Array.from({ length: 6 }, () => confirmPayment(prisma, order.id, payment.id)),
    ]);
    const [storedOrder, storedPayment] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
    ]);
    expect(storedOrder.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(storedPayment.status).toBe(OrderPaymentStatus.PAID);
    expect(await failPendingPayment(prisma, order.id, payment.id)).toBe(false);
  });

  it("requires attributed reasons for reprints", async () => {
    const order = await createOrder(102);
    await expect(
      createReprintIntent(prisma, {
        orderId: order.id,
        reason: " ",
        requestKey: `blank-${suffix}`,
        actor: { actorType: OrderActorType.ADMIN, actorId: "manager-1" },
      }),
    ).rejects.toThrow("Reprint reason is required");
    const initial = await ensureInitialPrintIntent(prisma, order.id);
    await prisma.printJob.update({ where: { id: initial.id }, data: { status: PrintJobStatus.PRINTED } });
    const reprint = await createReprintIntent(prisma, {
      orderId: order.id,
      reason: "Ticket damaged",
      requestKey: `damage-${suffix}`,
      actor: { actorType: OrderActorType.ADMIN, actorId: "manager-1" },
    });
    expect(reprint.reason).toBe("Ticket damaged");
    const replay = await createReprintIntent(prisma, {
      orderId: order.id,
      reason: "Ticket damaged",
      requestKey: `damage-${suffix}`,
      actor: { actorType: OrderActorType.ADMIN, actorId: "manager-1" },
    });
    expect(replay.id).toBe(reprint.id);
    await expect(
      createReprintIntent(prisma, {
        orderId: order.id,
        reason: "Different reason",
        requestKey: `damage-${suffix}`,
        actor: { actorType: OrderActorType.ADMIN, actorId: "manager-1" },
      }),
    ).rejects.toThrow("different payload");
    const unpaid = await createOrder(103, OrderPaymentStatus.PENDING);
    await expect(
      createReprintIntent(prisma, {
        orderId: unpaid.id,
        reason: "No ticket",
        requestKey: `unpaid-${suffix}`,
        actor: { actorType: OrderActorType.ADMIN, actorId: "manager-1" },
      }),
    ).rejects.toThrow("confirmed payment");
  });

  it("enforces one-to-four distinct active run stops and idempotent creation", async () => {
    const orders = await Promise.all(Array.from({ length: 6 }, (_, index) => createOrder(200 + index)));
    await expect(
      createDraftRun(prisma, {
        requestKey: `too-many-${suffix}`,
        zoneIdSnapshot: "zone-east",
        zoneNameSnapshot: "East",
        orderIds: orders.slice(0, 5).map((order) => order.id),
      }),
    ).rejects.toThrow("one to four");

    const run = await createDraftRun(prisma, {
      requestKey: `run-${suffix}`,
      zoneIdSnapshot: "zone-east",
      zoneNameSnapshot: "East",
      orderIds: orders.slice(0, 3).map((order) => order.id),
    });
    const repeated = await createDraftRun(prisma, {
      requestKey: `run-${suffix}`,
      zoneIdSnapshot: "zone-east",
      zoneNameSnapshot: "East",
      orderIds: orders.slice(0, 3).map((order) => order.id),
    });
    expect(repeated.id).toBe(run.id);
    await expect(
      createDraftRun(prisma, {
        requestKey: `run-${suffix}`,
        zoneIdSnapshot: "zone-west",
        zoneNameSnapshot: "West",
        orderIds: [orders[0].id],
      }),
    ).rejects.toThrow("different payload");

    const results = await Promise.allSettled([
      addStopToDraftRun(prisma, { runId: run.id, orderId: orders[3].id }),
      addStopToDraftRun(prisma, { runId: run.id, orderId: orders[4].id }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.deliveryStop.count({ where: { runId: run.id } })).toBe(4);

    await expect(
      createDraftRun(prisma, {
        requestKey: `duplicate-active-${suffix}`,
        zoneIdSnapshot: "zone-east",
        zoneNameSnapshot: "East",
        orderIds: [orders[0].id],
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("persists complete immutable operational snapshots and audit events", async () => {
    const order = await createOrder(300);
    const readyStart = new Date("2026-07-22T17:00:00.000Z");
    const promisedEnd = new Date("2026-07-22T18:15:00.000Z");
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        estimatedReadyStartAt: readyStart,
        promisedDeliveryEndAt: promisedEnd,
        dispatchDeadlineAt: new Date("2026-07-22T17:45:00.000Z"),
        deliveryFeeCents: 500,
        tipCents: 300,
        items: {
          create: {
            menuItemNameSnapshot: "Synthetic plate",
            menuItemDescriptionSnapshot: "Historical description",
            quantity: 2,
            unitPriceCents: 1_000,
            modifiersTotalCents: 200,
            lineSubtotalCents: 2_400,
            modifiers: {
              create: {
                modifierGroupNameSnapshot: "Sauce",
                modifierOptionNameSnapshot: "Hot",
                priceDeltaCents: 100,
                quantity: 1,
              },
            },
          },
        },
      },
      include: { items: { include: { modifiers: true } } },
    });
    expect(updated.deliveryZoneIdSnapshot).toBe("zone-east");
    expect(updated.promisedDeliveryEndAt).toEqual(promisedEnd);
    expect(updated.items[0]?.menuItemNameSnapshot).toBe("Synthetic plate");
    expect(updated.items[0]?.modifiers[0]?.modifierOptionNameSnapshot).toBe("Hot");

    const event = await prisma.orderEvent.create({
      data: { orderId: order.id, actorType: OrderActorType.SYSTEM, eventType: "IMMUTABLE_TEST" },
    });
    await expect(
      prisma.orderEvent.update({ where: { id: event.id }, data: { eventType: "MUTATED" } }),
    ).rejects.toThrow("audit events are immutable");
    await expect(prisma.orderEvent.delete({ where: { id: event.id } })).rejects.toThrow(
      "audit events are immutable",
    );
  });
});
