import {
  DeliveryRunStatus,
  DeliveryStopStatus,
  OrderActorType,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderProductionStatus,
  OrderServiceType,
  PaymentProvider,
  PrismaClient,
  PrintJobPurpose,
  PrintJobStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  acceptAndStartPreparing,
  addPreparationTime,
  expireOrderAcceptance,
  markReadyForDelivery,
  resumeOrderIntake,
} from "../../lib/orders/controller";
import {
  finalizeDeliveryWithProof,
  markDeliveryArrived,
  purgeExpiredDeliveryProofs,
  storeDeliveryProof,
} from "../../lib/orders/delivery-proof";
import { createOrderIdentity } from "../../lib/orders/identity";
import {
  confirmRunHandoff,
  createOperationalRun,
} from "../../lib/orders/run-operations";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";

const prisma = new PrismaClient({
  datasourceUrl: assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL),
});
const actor = { id: "controller-v2", label: "Kitchen Controller" };
let customerId: string;
let driverId: string;
let zoneId: string;

async function createPaidOrder(label: string, withPrint = true) {
  const identity = await createOrderIdentity(prisma);
  const order = await prisma.order.create({
    data: {
      ...identity,
      publicCode: `V2${label}${crypto.randomUUID().slice(0, 6)}`,
      serviceType: OrderServiceType.DELIVERY,
      paymentStatus: OrderPaymentStatus.PAID,
      customerId,
      customerName: "Vision Customer",
      customerPhone: "+15555551212",
      customerEmail: "vision@example.test",
      deliveryAddressLine1: "12 Vision Street",
      deliveryCity: "Châteauguay",
      deliveryProvince: "QC",
      deliveryPostalCode: "J6J 1A1",
      deliveryLatitude: 45.36,
      deliveryLongitude: -73.75,
      deliveryZoneIdSnapshot: zoneId,
      deliveryZoneNameSnapshot: "Vision zone",
      dispatchDeadlineAt: new Date(Date.now() + 30 * 60_000),
      estimatedReadyEndAt: new Date(Date.now() + 20 * 60_000),
      itemsSubtotalCents: 1000,
      taxableSubtotalCents: 1000,
      taxCents: 150,
      totalCents: 1150,
      payments: {
        create: {
          provider: PaymentProvider.CLOVER,
          status: OrderPaymentStatus.PAID,
          amountCents: 1150,
          currency: "CAD",
          providerPaymentId: `pay-${crypto.randomUUID()}`,
          providerIdempotencyKey: `payment-${crypto.randomUUID()}`,
        },
      },
      items: {
        create: {
          menuItemNameSnapshot: "Vision plate",
          quantity: 2,
          unitPriceCents: 500,
          lineSubtotalCents: 1000,
          specialInstructions: "No onions",
        },
      },
    },
  });
  if (withPrint)
    await prisma.printJob.create({
      data: {
        orderId: order.id,
        initialForOrderId: order.id,
        purpose: PrintJobPurpose.INITIAL,
        status: PrintJobStatus.PRINTED,
        idempotencyKey: `initial-${order.id}`,
        requestedByActorType: OrderActorType.SYSTEM,
      },
    });
  return prisma.order.findUniqueOrThrow({ where: { id: order.id } });
}

async function prepareReady(label: string) {
  const order = await createPaidOrder(label);
  await acceptAndStartPreparing({ orderId: order.id, actor });
  await markReadyForDelivery({
    orderId: order.id,
    actor,
    orderNumberConfirmed: true,
  });
  return prisma.order.findUniqueOrThrow({ where: { id: order.id } });
}

function fakeJpeg(fill: number) {
  const bytes = Buffer.alloc(128, fill);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[bytes.length - 1] = 0xd9;
  return bytes.toString("base64");
}

beforeAll(async () => {
  const customer = await prisma.customer.create({
    data: { name: "Vision Customer", phone: `+1777${Date.now().toString().slice(-7)}` },
  });
  customerId = customer.id;
  const zone = await prisma.deliveryZone.create({
    data: {
      name: `Vision zone ${crypto.randomUUID()}`,
      centerLatitude: 45.36,
      centerLongitude: -73.75,
      radiusKm: 8,
    },
  });
  zoneId = zone.id;
  const driver = await prisma.driver.create({
    data: {
      name: "Vision Driver",
      zoneEligibilities: { create: { deliveryZoneId: zone.id } },
      shifts: {
        create: {
          startsAt: new Date(Date.now() - 60_000),
          endsAt: new Date(Date.now() + 3_600_000),
        },
      },
    },
  });
  driverId = driver.id;
  await prisma.restaurantOrderSettings.upsert({
    where: { id: 1 },
    create: { id: 1, missedAcceptanceCount: 0 },
    update: {
      missedAcceptanceCount: 0,
      intakePausedAt: null,
      intakePauseReason: null,
      intakePausedBy: null,
    },
  });
});

afterAll(() => prisma.$disconnect());

describe("ordering experience lifecycle", () => {
  it("assigns an authoritative response deadline and exactly one deadline job", async () => {
    const order = await createPaidOrder("deadline");
    expect(order.acceptanceDeadlineAt).not.toBeNull();
    expect(
      order.acceptanceDeadlineAt!.getTime() - order.createdAt.getTime(),
    ).toBeGreaterThan(11 * 60_000);
    expect(
      await prisma.asyncJob.count({
        where: { dedupeKey: `order-acceptance:${order.id}` },
      }),
    ).toBe(1);
  });

  it("accepts and starts preparation exactly once while resetting the miss streak", async () => {
    const order = await createPaidOrder("accept");
    await prisma.restaurantOrderSettings.update({
      where: { id: 1 },
      data: { missedAcceptanceCount: 1 },
    });
    await Promise.all(
      Array.from({ length: 3 }, () =>
        acceptAndStartPreparing({ orderId: order.id, actor }),
      ),
    );
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.productionStatus).toBe(OrderProductionStatus.PREPARING);
    expect(updated.fulfillmentStatus).toBe(OrderFulfillmentStatus.PREPARING);
    expect(updated.acceptanceDecisionAt).not.toBeNull();
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: order.id,
          eventType: "ORDER_ACCEPTED_AND_PREPARATION_STARTED",
        },
      }),
    ).toBe(1);
    expect(
      (await prisma.restaurantOrderSettings.findUniqueOrThrow({ where: { id: 1 } }))
        .missedAcceptanceCount,
    ).toBe(0);
  });

  it("records packing evidence behind one visible ready action", async () => {
    const order = await createPaidOrder("ready");
    await acceptAndStartPreparing({ orderId: order.id, actor });
    await markReadyForDelivery({
      orderId: order.id,
      actor,
      orderNumberConfirmed: true,
    });
    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { packingChecks: true, items: true },
    });
    expect(updated.productionStatus).toBe(OrderProductionStatus.AT_DISPATCH_DESK);
    expect(updated.readyForDeliveryAt).not.toBeNull();
    expect(updated.packingChecks).toHaveLength(updated.items.length);
  });

  it("adds preparation time once when the controller request is retried", async () => {
    const order = await createPaidOrder("delay");
    await acceptAndStartPreparing({ orderId: order.id, actor });
    const requestKey = `delay-${crypto.randomUUID()}`;
    await Promise.all(
      Array.from({ length: 3 }, () =>
        addPreparationTime({
          orderId: order.id,
          minutes: 5,
          reason: "Kitchen test delay",
          requestKey,
          actor,
        }),
      ),
    );
    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updated.preparationExtendedMinutes).toBe(5);
    expect(
      await prisma.orderEvent.count({
        where: { orderId: order.id, eventType: "PREPARATION_TIME_ADDED" },
      }),
    ).toBe(1);
  });

  it("transfers ownership only at physical handoff and is idempotent", async () => {
    const order = await prepareReady("handoff");
    const run = await createOperationalRun(prisma, {
      requestKey: `run-${crypto.randomUUID()}`,
      orderIds: [order.id],
      driverId,
      actor,
    });
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
        .fulfillmentStatus,
    ).toBe(OrderFulfillmentStatus.DRIVER_ASSIGNED);
    await Promise.all(
      Array.from({ length: 3 }, () =>
        confirmRunHandoff(prisma, { runId: run.id, actor }),
      ),
    );
    const [updatedOrder, updatedRun] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      prisma.deliveryRun.findUniqueOrThrow({ where: { id: run.id } }),
    ]);
    expect(updatedOrder.fulfillmentStatus).toBe(OrderFulfillmentStatus.ON_THE_WAY);
    expect(updatedRun.status).toBe(DeliveryRunStatus.EN_ROUTE);
    expect(updatedRun.handedOffAt).not.toBeNull();
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: order.id,
          eventType: "RUN_DISPATCHED_AT_PHYSICAL_HANDOFF",
        },
      }),
    ).toBe(1);
    await prisma.deliveryStop.updateMany({
      where: { runId: run.id },
      data: { status: DeliveryStopStatus.DELIVERED, deliveredAt: new Date() },
    });
    await prisma.deliveryRun.update({
      where: { id: run.id },
      data: { status: DeliveryRunStatus.COMPLETED, completedAt: new Date() },
    });
  });

  it("enforces stop order, arrival, private proof, and proof-bound completion", async () => {
    const orders = await Promise.all([prepareReady("proof-a"), prepareReady("proof-b")]);
    const run = await createOperationalRun(prisma, {
      requestKey: `proof-run-${crypto.randomUUID()}`,
      orderIds: orders.map((order) => order.id),
      driverId,
      actor,
    });
    await confirmRunHandoff(prisma, { runId: run.id, actor });
    await expect(
      markDeliveryArrived({ runId: run.id, orderId: orders[1]!.id, driverId }),
    ).rejects.toMatchObject({ code: "STOP_OUT_OF_SEQUENCE" });
    await markDeliveryArrived({ runId: run.id, orderId: orders[0]!.id, driverId });
    await expect(
      finalizeDeliveryWithProof({ runId: run.id, orderId: orders[0]!.id, driverId }),
    ).rejects.toMatchObject({ code: "DELIVERY_PROOF_REQUIRED" });
    await expect(
      storeDeliveryProof({
        runId: run.id,
        orderId: orders[0]!.id,
        driverId,
        mimeType: "image/jpeg",
        base64: Buffer.alloc(128, 7).toString("base64"),
        capturedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "PROOF_CONTENT_INVALID" });
    const bytes = fakeJpeg(7);
    await storeDeliveryProof({
      runId: run.id,
      orderId: orders[0]!.id,
      driverId,
      mimeType: "image/jpeg",
      base64: bytes,
      capturedAt: new Date(),
    });
    const first = await finalizeDeliveryWithProof({
      runId: run.id,
      orderId: orders[0]!.id,
      driverId,
    });
    expect(first.nextStop?.status).toBe(DeliveryStopStatus.EN_ROUTE);
    await markDeliveryArrived({ runId: run.id, orderId: orders[1]!.id, driverId });
    await storeDeliveryProof({
      runId: run.id,
      orderId: orders[1]!.id,
      driverId,
      mimeType: "image/jpeg",
      base64: fakeJpeg(8),
      capturedAt: new Date(),
    });
    const second = await finalizeDeliveryWithProof({
      runId: run.id,
      orderId: orders[1]!.id,
      driverId,
    });
    expect(second.completed).toBe(true);
    expect(
      (await prisma.deliveryRun.findUniqueOrThrow({ where: { id: run.id } })).status,
    ).toBe(DeliveryRunStatus.COMPLETED);
    const proof = await prisma.deliveryProof.findUniqueOrThrow({
      where: {
        stopId: (
          await prisma.deliveryStop.findFirstOrThrow({
            where: { runId: run.id, orderId: orders[0]!.id },
          })
        ).id,
      },
    });
    expect(proof.imageBytes.byteLength).toBe(128);
    await prisma.restaurantOrderSettings.update({
      where: { id: 1 },
      data: { proofRetentionDays: 1 },
    });
    await prisma.deliveryProof.update({
      where: { id: proof.id },
      data: { storedAt: new Date("2026-01-01T00:00:00.000Z") },
    });
    expect((await purgeExpiredDeliveryProofs(new Date("2026-01-03T00:00:00.000Z"))).deleted).toBe(1);
    expect(await prisma.deliveryProof.findUnique({ where: { id: proof.id } })).toBeNull();
  });

  it("pauses intake after two consecutive deadline misses and preserves reservations", async () => {
    const reservation = await prisma.reservation.create({
      data: {
        confirmationCode: `KEEP-${crypto.randomUUID()}`,
        manageToken: `keep-${crypto.randomUUID()}`,
        reservationDate: new Date("2026-09-01T00:00:00.000Z"),
        reservationTime: new Date("1970-01-01T18:00:00.000Z"),
        reservationAt: new Date("2026-09-01T22:00:00.000Z"),
        partySize: 4,
        guestName: "Protected Reservation",
        guestPhone: "+15555559999",
        guestEmail: "reservation@example.test",
        specialRequests: "Do not alter",
      },
    });
    await prisma.restaurantOrderSettings.update({
      where: { id: 1 },
      data: {
        missedAcceptanceCount: 0,
        intakePausedAt: null,
        intakePauseReason: null,
        intakePausedBy: null,
      },
    });
    const orders = await Promise.all([
      createPaidOrder("timeout-a"),
      createPaidOrder("timeout-b"),
    ]);
    const fakeRefund = async ({
      payment,
      amountCents,
      idempotencyKey,
    }: Parameters<NonNullable<Parameters<typeof expireOrderAcceptance>[2]>>[0]) => ({
      state: "succeeded" as const,
      providerOperation: "refund" as const,
      succeeded: true,
      partial: false,
      pending: false,
      unknown: false,
      failed: false,
      providerRefundId: `refund-${crypto.randomUUID()}`,
      providerPaymentId: payment.providerPaymentId,
      providerOrderId: payment.providerOrderId,
      idempotencyKey,
      amountCents,
      errorCode: null,
      rawResponse: { fake: true },
    });
    for (const [index, order] of orders.entries()) {
      const deadline = new Date(Date.now() - 1000);
      await prisma.order.update({
        where: { id: order.id },
        data: { acceptanceDeadlineAt: deadline },
      });
      const result = await expireOrderAcceptance(
        order.id,
        new Date(),
        fakeRefund,
      );
      expect(result.expired).toBe(true);
      expect(result.paused).toBe(index === 1);
    }
    const settings = await prisma.restaurantOrderSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    expect(settings.missedAcceptanceCount).toBe(2);
    expect(settings.intakePausedAt).not.toBeNull();
    expect(settings.intakePauseReason).toBe("MISSED_ACCEPTANCE_DEADLINES");
    expect(await prisma.reservation.findUnique({ where: { id: reservation.id } })).toEqual(reservation);
    await resumeOrderIntake({ actor, reason: "Database test cleanup" });
  });
});
