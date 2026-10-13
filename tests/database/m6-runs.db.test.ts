import { DeliveryRunStatus, OrderDispatchStatus, OrderFulfillmentStatus, OrderPaymentStatus, OrderProductionStatus, OrderServiceType, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrderIdentity } from "../../lib/orders/identity";
import { confirmFailedStopReturnedToDesk, createOperationalRun, pickupRun, resolveRunException, updateDriverStop, verifyRunBag } from "../../lib/orders/run-operations";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";

const prisma = new PrismaClient({ datasourceUrl: assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL) });
let customerId: string;
let driverId: string;
let zoneId: string;

async function readyOrder(index: number, zone = zoneId) {
  return prisma.order.create({ data: {
    ...(await createOrderIdentity(prisma)), publicCode: `M6${Date.now().toString(36)}${index}`,
    serviceType: OrderServiceType.DELIVERY, paymentStatus: OrderPaymentStatus.PAID,
    productionStatus: OrderProductionStatus.AT_DISPATCH_DESK,
    customerId, customerName: "M6", customerPhone: "+15555550600",
    deliveryZoneIdSnapshot: zone, deliveryZoneNameSnapshot: zone,
    itemsSubtotalCents: 1000, taxableSubtotalCents: 1000, taxCents: 150, totalCents: 1150,
  } });
}

beforeAll(async () => {
  const customer = await prisma.customer.create({ data: { name: "M6", phone: `+1666${Date.now().toString().slice(-7)}` } }); customerId = customer.id;
  const zone = await prisma.deliveryZone.create({ data: { name: "East M6", centerLatitude: 45.5, centerLongitude: -73.5, radiusKm: 8 } }); zoneId = zone.id;
  const driver = await prisma.driver.create({ data: { name: "Driver M6", zoneEligibilities: { create: { deliveryZoneId: zone.id } }, shifts: { create: { startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000) } } } }); driverId = driver.id;
});
afterAll(() => prisma.$disconnect());

describe("M6 operational runs", () => {
  it("requires desk-ready same-zone bags and scopes pickup to the assigned driver", async () => {
    const orders = await Promise.all([readyOrder(1), readyOrder(2)]);
    const run = await createOperationalRun(prisma, { requestKey: `m6-${Date.now()}`, orderIds: orders.map((order) => order.id), driverId, actor: { id: "dispatcher" } });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orders[0]!.id } })).fulfillmentStatus).toBe(OrderFulfillmentStatus.DRIVER_ASSIGNED);
    await expect(pickupRun(prisma, { runId: run.id, driverId })).rejects.toMatchObject({ code: "RUN_NOT_READY" });
    for (const order of orders) await verifyRunBag(prisma, { runId: run.id, orderId: order.id, actor: { id: "dispatcher" } });
    const picked = await pickupRun(prisma, { runId: run.id, driverId });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orders[0]!.id } })).fulfillmentStatus).toBe(OrderFulfillmentStatus.PICKED_UP);
    expect(picked.stops.map((stop) => stop.position)).toEqual([1, 2]);
    await expect(pickupRun(prisma, { runId: run.id, driverId: "other-driver" })).rejects.toMatchObject({ code: "RUN_SCOPE_DENIED" });
  });

  it("rejects cross-zone batching without a reasoned override", async () => {
    const orders = await Promise.all([readyOrder(3), readyOrder(4, "other-zone")]);
    await expect(createOperationalRun(prisma, { requestKey: `m6-cross-${Date.now()}`, orderIds: orders.map((order) => order.id), driverId, actor: { id: "dispatcher" } })).rejects.toMatchObject({ code: "CROSS_ZONE_FORBIDDEN" });
  });

  it("persists a reasoned cross-zone override and route explanation", async () => {
    const zone = await prisma.deliveryZone.create({ data: { name: `West M6 ${crypto.randomUUID()}`, centerLatitude: 45.6, centerLongitude: -73.6, radiusKm: 8 } });
    await prisma.driverZoneEligibility.create({ data: { driverId, deliveryZoneId: zone.id } });
    const orders = await Promise.all([readyOrder(8), readyOrder(9, zone.id)]);
    const run = await createOperationalRun(prisma, { requestKey: `m6-override-${Date.now()}`, orderIds: orders.map((order) => order.id), driverId, allowCrossZone: true, overrideReason: "Dispatcher approved a time-critical cross-zone run", routePlan: { explanation: "Deterministic same-shift manual route", routingStatus: "MANUAL_SELECTION", durationSeconds: 900, distanceMeters: 8000 }, actor: { id: "dispatcher" } });
    expect(run).toMatchObject({ crossZoneOverride: true, routingStatus: "MANUAL_SELECTION", estimatedDurationSeconds: 900, estimatedDistanceMeters: 8000 });
    expect(await prisma.orderEvent.count({ where: { orderId: { in: orders.map((order) => order.id) }, eventType: "DELIVERY_RUN_APPROVED" } })).toBe(2);
  });

  it("rechecks shift eligibility at pickup", async () => {
    const value = await readyOrder(5);
    const run = await createOperationalRun(prisma, { requestKey: `m6-shift-${Date.now()}`, orderIds: [value.id], driverId, actor: { id: "dispatcher" } });
    await verifyRunBag(prisma, { runId: run.id, orderId: value.id, actor: { id: "dispatcher" } });
    await prisma.driverShift.updateMany({ where: { driverId, isActive: true }, data: { endsAt: new Date(Date.now() - 1_000) } });
    await expect(pickupRun(prisma, { runId: run.id, driverId })).rejects.toMatchObject({ code: "DRIVER_INELIGIBLE" });
    await prisma.driverShift.create({ data: { driverId, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000) } });
    await pickupRun(prisma, { runId: run.id, driverId });
  });

  it("requires physical return to the desk before requeuing a failed stop", async () => {
    const value = await readyOrder(6);
    const run = await createOperationalRun(prisma, { requestKey: `m6-exception-${Date.now()}`, orderIds: [value.id], driverId, actor: { id: "dispatcher" } });
    await verifyRunBag(prisma, { runId: run.id, orderId: value.id, actor: { id: "dispatcher" } });
    await pickupRun(prisma, { runId: run.id, driverId });
    await updateDriverStop(prisma, { runId: run.id, orderId: value.id, driverId, action: "EN_ROUTE" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: value.id } })).fulfillmentStatus).toBe(OrderFulfillmentStatus.ON_THE_WAY);
    await updateDriverStop(prisma, { runId: run.id, orderId: value.id, driverId, action: "FAILED", reason: "Customer unreachable" });
    await expect(resolveRunException(prisma, { runId: run.id, reason: "Attempted early close", actor: { id: "dispatcher" } })).rejects.toMatchObject({ code: "RUN_EXCEPTION_ACTIVE_STOPS" });
    const returned = await confirmFailedStopReturnedToDesk(prisma, { runId: run.id, orderId: value.id, reason: "Dispatcher physically verified returned bag", actor: { id: "dispatcher" } });
    expect(returned.status).toBe("RETURNED_TO_DESK");
    const resolved = await resolveRunException(prisma, { runId: run.id, reason: "Returned bag is ready for a new approved run", actor: { id: "dispatcher" } });
    expect(resolved.status).toBe(DeliveryRunStatus.COMPLETED);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: value.id } })).dispatchStatus).toBe(OrderDispatchStatus.UNASSIGNED);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: value.id } })).fulfillmentStatus).toBe(OrderFulfillmentStatus.READY_FOR_PICKUP);
  });

  it("rejects an order with an active legacy direct assignment", async () => {
    const value = await readyOrder(7);
    await prisma.driverAssignment.create({ data: { orderId: value.id, driverId } });
    await expect(createOperationalRun(prisma, { requestKey: `m6-legacy-${Date.now()}`, orderIds: [value.id], driverId, actor: { id: "dispatcher" } })).rejects.toMatchObject({ code: "LEGACY_ASSIGNMENT_ACTIVE" });
  });
});
