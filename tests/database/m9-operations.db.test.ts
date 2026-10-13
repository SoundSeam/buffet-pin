import { NotificationChannel, NotificationStatus, OperationalAlertStatus, OrderFulfillmentStatus, OrderPaymentStatus, OrderServiceType, Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanOperationalAlerts } from "../../lib/operations/alerts";
import { enforceOrderIntakeControls } from "../../lib/orders/intake";
import { createOrderIdentity } from "../../lib/orders/identity";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";
import { withSerializableRetry } from "../../lib/db-transactions";
import {
  attachMachineTestGrantToOrderInTransaction,
  issueMachineTestGrant,
} from "../../lib/operations/machine-test-grant";

const prisma = new PrismaClient({ datasourceUrl: assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL) });
let customerId: string;

async function createMinimalOrder(tx: Prisma.TransactionClient, suffix: string) {
  const identity = await createOrderIdentity(tx);
  return tx.order.create({ data: { ...identity, publicCode: `M9${suffix}${crypto.randomUUID().slice(0, 6)}`, serviceType: OrderServiceType.DELIVERY, customerId, customerName: "M9", customerPhone: "+15555550900", itemsSubtotalCents: 1000, taxableSubtotalCents: 1000, taxCents: 150, totalCents: 1150 } });
}

beforeAll(async () => { customerId = (await prisma.customer.create({ data: { name: "M9", phone: `+1555${Date.now().toString().slice(-7)}` } })).id; });
afterAll(() => prisma.$disconnect());

describe("M9 operations", () => {
  it("admits exactly one deployed test order while public ordering stays off", async () => {
    await prisma.restaurantOrderSettings.upsert({
      where: { id: 1 },
      create: { id: 1, onlineOrderingEnabled: false, maxActiveOrders: null },
      update: { onlineOrderingEnabled: false, maxActiveOrders: null },
    });
    const issued = await issueMachineTestGrant(
      { staffId: "test-manager", label: "Test Manager" },
      prisma,
    );

    const attempts = await Promise.allSettled(
      ["grant-a", "grant-b"].map((suffix) =>
        withSerializableRetry(prisma, async (tx) => {
          const intake = await enforceOrderIntakeControls(tx, {
            machineTestGrantToken: issued.rawToken,
          });
          const order = await createMinimalOrder(tx, suffix);
          if (!intake.machineTestGrantId) throw new Error("Test grant was not consumed.");
          await attachMachineTestGrantToOrderInTransaction(
            tx,
            intake.machineTestGrantId,
            order.id,
          );
          return order;
        }),
      ),
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    await expect(
      prisma.machineTestGrant.findUniqueOrThrow({ where: { id: issued.grant.id } }),
    ).resolves.toMatchObject({
      consumedAt: expect.any(Date),
      orderId: expect.any(String),
    });
  });

  it("enforces the active-order limit under concurrent intake", async () => {
    const active = await prisma.order.count({ where: {
      fulfillmentStatus: { notIn: [OrderFulfillmentStatus.DELIVERED, OrderFulfillmentStatus.REJECTED, OrderFulfillmentStatus.CANCELLED] },
      OR: [
        { paymentStatus: { in: [OrderPaymentStatus.PAID, OrderPaymentStatus.PARTIALLY_REFUNDED] } },
        { paymentStatus: OrderPaymentStatus.PENDING, createdAt: { gte: new Date(Date.now() - 20 * 60_000) } },
      ],
    } });
    await prisma.restaurantOrderSettings.upsert({ where: { id: 1 }, create: { id: 1, onlineOrderingEnabled: true, maxActiveOrders: active + 2 }, update: { onlineOrderingEnabled: true, maxActiveOrders: active + 2 } });
    const attempts = await Promise.allSettled(Array.from({ length: 4 }, (_, index) => withSerializableRetry(prisma, async (tx) => {
      await enforceOrderIntakeControls(tx);
      return createMinimalOrder(tx, String(index));
    })));
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(2);
  });

  it("deduplicates persistent failure alerts and resolves cleared sources", async () => {
    const order = await prisma.order.update({ where: { id: (await createMinimalOrder(prisma as unknown as Prisma.TransactionClient, "alert")).id }, data: { paymentStatus: OrderPaymentStatus.PAID, createdAt: new Date(Date.now() - 60 * 60_000) } });
    await prisma.notification.create({ data: { orderId: order.id, recipient: "+15555550900", channel: NotificationChannel.SMS, templateKey: "m9-test", idempotencyKey: `m9:${order.id}`, body: "test", status: NotificationStatus.FAILED } });
    const first = await scanOperationalAlerts();
    const second = await scanOperationalAlerts();
    expect(first.candidateCount).toBeGreaterThan(0);
    expect(await prisma.operationalAlert.count({ where: { alertKey: `paid-unprinted:${order.id}` } })).toBe(1);
    expect(second.candidateCount).toBe(first.candidateCount);
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: OrderPaymentStatus.REFUNDED } });
    await prisma.notification.update({ where: { idempotencyKey: `m9:${order.id}` }, data: { status: NotificationStatus.SENT } });
    await scanOperationalAlerts();
    expect((await prisma.operationalAlert.findUniqueOrThrow({ where: { alertKey: `paid-unprinted:${order.id}` } })).status).toBe(OperationalAlertStatus.RESOLVED);
  });

  it("does not reopen a completed prior-day reconciliation", async () => {
    const now = new Date("2026-07-22T16:00:00.000Z");
    const order = await createMinimalOrder(prisma as unknown as Prisma.TransactionClient, "reconcile");
    await prisma.payment.create({ data: { orderId: order.id, provider: "CLOVER", status: OrderPaymentStatus.PAID, amountCents: order.totalCents, currency: "CAD", providerPaymentId: `m9-payment-${crypto.randomUUID()}`, paidAt: new Date("2026-07-21T16:00:00.000Z") } });
    await scanOperationalAlerts(now);
    const key = "reconciliation-required:2026-07-21";
    expect(await prisma.operationalAlert.findUnique({ where: { alertKey: key } })).toMatchObject({ status: OperationalAlertStatus.OPEN });
    await prisma.reconciliationImport.create({ data: { serviceDate: "2026-07-21", timezone: "America/Toronto", source: "TEST_SANITIZED_IMPORT", importedBy: "manager", providerRowCount: 1, providerRows: [], report: {} } });
    await prisma.operationalAlert.update({ where: { alertKey: key }, data: { status: OperationalAlertStatus.RESOLVED, resolvedAt: new Date(), resolutionNote: "Imported" } });
    await scanOperationalAlerts(now);
    expect(await prisma.operationalAlert.findUnique({ where: { alertKey: key } })).toMatchObject({ status: OperationalAlertStatus.RESOLVED });
  });
});
