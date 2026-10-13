import {
  AsyncJobLane,
  AsyncJobState,
  NotificationChannel,
  OrderActorType,
  OrderServiceType,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";

const prisma = new PrismaClient({ datasourceUrl: assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL) });
afterAll(() => prisma.$disconnect());

describe("M11 transactional async intents", () => {
  it("enqueues one notification delivery intent in the notification transaction", async () => {
    const notification = await prisma.notification.create({
      data: {
        recipient: "+15555551101",
        channel: NotificationChannel.SMS,
        templateKey: "m11-test",
        idempotencyKey: `m11-notification:${crypto.randomUUID()}`,
        body: "Test",
      },
    });

    await expect(prisma.asyncJob.findMany({ where: { aggregateType: "Notification", aggregateId: notification.id } })).resolves.toEqual([
      expect.objectContaining({
        kind: "SEND_NOTIFICATION",
        lane: AsyncJobLane.NOTIFICATION,
        state: AsyncJobState.PENDING,
        dedupeKey: `notification:${notification.id}`,
      }),
    ]);
  });

  it("creates an opaque invalidation intent for every immutable order event", async () => {
    const customer = await prisma.customer.create({ data: { name: "M11", phone: `+1555${Date.now().toString().slice(-7)}` } });
    const order = await prisma.order.create({
      data: {
        publicCode: `M11${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        serviceType: OrderServiceType.DELIVERY,
        customerId: customer.id,
        customerName: "M11",
        customerPhone: customer.phone,
        itemsSubtotalCents: 1000,
        taxableSubtotalCents: 1000,
        taxCents: 150,
        totalCents: 1150,
      },
    });
    const event = await prisma.orderEvent.create({
      data: { orderId: order.id, actorType: OrderActorType.SYSTEM, eventType: "M11_TEST" },
    });

    await expect(prisma.asyncJob.findUnique({ where: { dedupeKey: `order-event:${event.id}` } })).resolves.toMatchObject({
      kind: "REALTIME_INVALIDATION",
      lane: AsyncJobLane.CRITICAL,
      aggregateType: "Order",
      aggregateId: order.id,
      state: AsyncJobState.PENDING,
      payload: { revision: event.id },
    });
  });

  it("replaces a reservation deadline and cancels every superseded reminder intent", async () => {
    const originalAt = new Date(Date.now() + 72 * 60 * 60_000);
    const reservation = await prisma.reservation.create({
      data: {
        confirmationCode: `M11-${crypto.randomUUID()}`,
        manageToken: crypto.randomUUID(),
        status: ReservationStatus.CONFIRMED,
        reservationDate: originalAt,
        reservationTime: originalAt,
        reservationAt: originalAt,
        partySize: 6,
        guestName: "M11",
        guestPhone: "+15555551102",
      },
    });
    const first = await prisma.asyncJob.findFirstOrThrow({
      where: { aggregateType: "Reservation", aggregateId: reservation.id, kind: "SEND_RESERVATION_REMINDER" },
    });
    expect(first.runAt.getTime()).toBe(originalAt.getTime() - 24 * 60 * 60_000);

    const movedAt = new Date(originalAt.getTime() + 60 * 60_000);
    await prisma.reservation.update({ where: { id: reservation.id }, data: { reservationAt: movedAt } });
    const movedJobs = await prisma.asyncJob.findMany({
      where: { aggregateType: "Reservation", aggregateId: reservation.id, kind: "SEND_RESERVATION_REMINDER" },
      orderBy: { createdAt: "asc" },
    });
    expect(movedJobs).toHaveLength(2);
    expect(movedJobs.filter((job) => job.state === AsyncJobState.CANCELLED)).toHaveLength(1);
    expect(movedJobs.filter((job) => job.state === AsyncJobState.PENDING)).toEqual([
      expect.objectContaining({ runAt: new Date(movedAt.getTime() - 24 * 60 * 60_000) }),
    ]);

    await prisma.reservation.update({ where: { id: reservation.id }, data: { status: ReservationStatus.CANCELLED } });
    await expect(prisma.asyncJob.count({
      where: {
        aggregateType: "Reservation",
        aggregateId: reservation.id,
        kind: "SEND_RESERVATION_REMINDER",
        state: { not: AsyncJobState.CANCELLED },
      },
    })).resolves.toBe(0);
  });
});
