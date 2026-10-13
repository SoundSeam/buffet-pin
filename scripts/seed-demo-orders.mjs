import crypto from "node:crypto";

import {
  DeliveryRunStatus,
  DeliveryStopStatus,
  OrderActorType,
  OrderDispatchStatus,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderProductionStatus,
  OrderRefundStatus,
  OrderServiceType,
  PaymentProvider,
  PrintJobPurpose,
  PrintJobStatus,
  PrismaClient,
  RefundIntentStatus,
} from "@prisma/client";

const CONFIRMATION_FLAG = "--confirm-demo-reset";
const RESTAURANT_LATITUDE = 45.360646;
const RESTAURANT_LONGITUDE = -73.713994;
const DEMO_ZONE_ID = "demo-zone-chateauguay";
const DEMO_SHIFT_ID = "demo-driver-shift";
const DEMO_NOTE = "DEMO FIXTURE — never prepare, dispatch, charge, refund, or contact.";
const prisma = new PrismaClient();

function assertSafeDemoTarget() {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    throw new Error(`Refusing to replace orders without ${CONFIRMATION_FLAG}.`);
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to seed demo orders in a production runtime.");
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is required to identify the demo target.");
  const hostname = new URL(appUrl).hostname.toLowerCase();
  const isDemoHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".ngrok-free.app") ||
    process.env.ALLOW_DEMO_DATA_RESET === "1";
  if (!isDemoHost) {
    throw new Error(
      `Refusing to seed ${hostname}; use a local/ngrok APP_URL or explicitly set ALLOW_DEMO_DATA_RESET=1.`,
    );
  }
}

function serviceDateStamp(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}${value("month")}${value("day")}`;
}

function minutesFrom(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function taxFor(itemsSubtotalCents) {
  const gstCents = Math.round((itemsSubtotalCents * 50_000) / 1_000_000);
  const qstCents = Math.round((itemsSubtotalCents * 99_750) / 1_000_000);
  return { gstCents, qstCents, taxCents: gstCents + qstCents };
}

function stageTimestamps(stage, createdAt) {
  const timestamps = {};
  if (
    ["ACCEPTED", "PREPARING", "PACKING", "PACKED", "DESK", "RUN_APPROVED", "RUN_READY", "COMPLETED"].includes(
      stage,
    )
  ) {
    timestamps.acceptedAt = minutesFrom(createdAt, 2);
  }
  if (["PREPARING", "PACKING", "PACKED", "DESK", "RUN_APPROVED", "RUN_READY", "COMPLETED"].includes(stage)) {
    timestamps.preparationStartedAt = minutesFrom(createdAt, 4);
  }
  if (["PACKING", "PACKED", "DESK", "RUN_APPROVED", "RUN_READY", "COMPLETED"].includes(stage)) {
    timestamps.packingStartedAt = minutesFrom(createdAt, 6);
  }
  if (["PACKED", "DESK", "RUN_APPROVED", "RUN_READY", "COMPLETED"].includes(stage)) {
    timestamps.packedAt = minutesFrom(createdAt, 8);
  }
  if (["DESK", "RUN_APPROVED", "RUN_READY", "COMPLETED"].includes(stage)) {
    timestamps.atDispatchDeskAt = minutesFrom(createdAt, 10);
  }
  if (stage === "COMPLETED") timestamps.completedAt = minutesFrom(createdAt, 35);
  if (stage === "REFUNDED") timestamps.cancelledAt = minutesFrom(createdAt, 4);
  return timestamps;
}

function stageState(stage) {
  switch (stage) {
    case "AWAITING_ACCEPTANCE":
      return {
        productionStatus: OrderProductionStatus.AWAITING_ACCEPTANCE,
        fulfillmentStatus: OrderFulfillmentStatus.AWAITING_ACCEPTANCE,
        dispatchStatus: OrderDispatchStatus.UNASSIGNED,
      };
    case "ACCEPTED":
      return {
        productionStatus: OrderProductionStatus.ACCEPTED,
        fulfillmentStatus: OrderFulfillmentStatus.ACCEPTED,
        dispatchStatus: OrderDispatchStatus.UNASSIGNED,
      };
    case "PREPARING":
      return {
        productionStatus: OrderProductionStatus.PREPARING,
        fulfillmentStatus: OrderFulfillmentStatus.PREPARING,
        dispatchStatus: OrderDispatchStatus.UNASSIGNED,
      };
    case "PACKING":
      return {
        productionStatus: OrderProductionStatus.PACKING,
        fulfillmentStatus: OrderFulfillmentStatus.PREPARING,
        dispatchStatus: OrderDispatchStatus.UNASSIGNED,
      };
    case "PACKED":
      return {
        productionStatus: OrderProductionStatus.PACKED,
        fulfillmentStatus: OrderFulfillmentStatus.PREPARING,
        dispatchStatus: OrderDispatchStatus.UNASSIGNED,
      };
    case "DESK":
      return {
        productionStatus: OrderProductionStatus.AT_DISPATCH_DESK,
        fulfillmentStatus: OrderFulfillmentStatus.READY_FOR_PICKUP,
        dispatchStatus: OrderDispatchStatus.UNASSIGNED,
      };
    case "RUN_APPROVED":
      return {
        productionStatus: OrderProductionStatus.AT_DISPATCH_DESK,
        fulfillmentStatus: OrderFulfillmentStatus.DRIVER_ASSIGNED,
        dispatchStatus: OrderDispatchStatus.RUN_PLANNED,
      };
    case "RUN_READY":
      return {
        productionStatus: OrderProductionStatus.AT_DISPATCH_DESK,
        fulfillmentStatus: OrderFulfillmentStatus.DRIVER_ASSIGNED,
        dispatchStatus: OrderDispatchStatus.READY_FOR_PICKUP,
      };
    case "COMPLETED":
      return {
        productionStatus: OrderProductionStatus.AT_DISPATCH_DESK,
        fulfillmentStatus: OrderFulfillmentStatus.DELIVERED,
        dispatchStatus: OrderDispatchStatus.DELIVERED,
      };
    case "REFUNDED":
      return {
        productionStatus: OrderProductionStatus.CANCELLED,
        fulfillmentStatus: OrderFulfillmentStatus.CANCELLED,
        dispatchStatus: OrderDispatchStatus.CANCELLED,
      };
    default:
      throw new Error(`Unknown demo stage: ${stage}`);
  }
}

function eventHistory(stage, createdAt) {
  const events = [
    {
      actorType: OrderActorType.SYSTEM,
      actorLabel: "Demo data seeder",
      eventType: "DEMO_ORDER_CREATED",
      message: DEMO_NOTE,
      createdAt,
    },
    {
      actorType: OrderActorType.WEBHOOK,
      actorLabel: "Synthetic Clover fixture",
      eventType: "PAYMENT_CONFIRMED",
      fromPaymentStatus: OrderPaymentStatus.PENDING,
      toPaymentStatus: OrderPaymentStatus.PAID,
      createdAt: minutesFrom(createdAt, 1),
    },
    {
      actorType: OrderActorType.SYSTEM,
      actorLabel: "Synthetic kitchen printer",
      eventType: "INITIAL_PRINT_CONFIRMED",
      createdAt: minutesFrom(createdAt, 1.5),
    },
  ];
  if (stage !== "AWAITING_ACCEPTANCE" && stage !== "REFUNDED") {
    events.push({
      actorType: OrderActorType.ADMIN,
      actorLabel: "Demo Operator",
      eventType: `DEMO_STAGE_${stage}`,
      message: `Synthetic order positioned at ${stage.replaceAll("_", " ")}.`,
      createdAt: minutesFrom(createdAt, 2),
    });
  }
  if (stage === "REFUNDED") {
    events.push({
      actorType: OrderActorType.ADMIN,
      actorLabel: "Demo Manager",
      eventType: "ORDER_CANCELLED",
      message: "Synthetic customer cancellation with completed mock refund.",
      createdAt: minutesFrom(createdAt, 4),
    });
  }
  return events;
}

function orderStageDefinitions() {
  return [
    { key: "AWAITING_ACCEPTANCE", label: "new paid order" },
    { key: "ACCEPTED", label: "accepted" },
    { key: "PREPARING", label: "preparing" },
    { key: "PACKING", label: "packing verification" },
    { key: "PACKED", label: "packed handoff" },
    { key: "DESK", label: "waiting at dispatch desk" },
    { key: "RUN_APPROVED", label: "approved run bag verification" },
    { key: "RUN_READY", label: "driver pickup-ready manifest" },
    { key: "COMPLETED", label: "completed delivery" },
    { key: "REFUNDED", label: "cancelled and refunded" },
  ];
}

const customers = [
  ["Sophie Tremblay", "101 Rue Principale", "J6J 3H2", 45.3662, -73.7171, "Sonner à l'entrée principale."],
  ["Marc-André Bouchard", "225 Boulevard D'Anjou", "J6J 2R3", 45.3591, -73.7255, "Appartement 4; appeler à l'arrivée."],
  ["Nadia Benali", "48 Rue Saint-Joseph", "J6K 2A7", 45.3658, -73.7082, "Déposer au comptoir de réception."],
  ["Émilie Gagnon", "310 Boulevard Saint-Francis", "J6J 1Z3", 45.3568, -73.7018, "Porte latérale près du stationnement."],
  ["David Nguyen", "76 Rue Taylor", "J6J 2V4", 45.3721, -73.7198, "Bébé dort; ne pas sonner."],
  ["Karine Roy", "155 Rue de Ville-Marie", "J6J 3N8", 45.3496, -73.7231, "Maison avec galerie bleue."],
  ["Samuel Fortin", "92 Rue Notre-Dame Nord", "J6J 4T5", 45.3714, -73.7352, "Remettre en main propre."],
  ["Amina El Mansouri", "410 Boulevard Maple", "J6J 5K6", 45.3542, -73.7421, "Code d'entrée 2040."],
  ["Julie Lefebvre", "33 Rue Trudeau", "J6J 1M9", 45.3449, -73.7092, "Chien dans la cour; appeler d'abord."],
  ["Alex Chen", "187 Rue Edmour", "J6J 5E4", 45.3764, -73.7124, "Unité 6, deuxième étage."],
  ["Mélanie Côté", "64 Rue Sainte-Marguerite", "J6K 1M3", 45.3617, -73.6928, "Laisser à la réception de l'immeuble."],
  ["Thomas Pelletier", "520 Boulevard René-Lévesque", "J6K 3B4", 45.3511, -73.6879, "Entrée sur le côté est."],
  ["Fatima Zahra", "118 Rue Vincent", "J6J 4C8", 45.3792, -73.7287, "Téléphoner deux minutes avant."],
  ["Olivier Martin", "275 Rue McLeod", "J6J 2H1", 45.3683, -73.7462, "Bureau 12, porte vitrée."],
  ["Chloé Dubois", "39 Rue Prince", "J6J 3L7", 45.3468, -73.7324, "Interphone 309."],
  ["Rami Haddad", "143 Rue Craik", "J6J 2S8", 45.3584, -73.7514, "Livrer à l'accueil."],
];

function buildCartVariants(menu) {
  const modifier = (group, option) => ({
    modifierGroupId: group.id,
    modifierOptionId: option.id,
    modifierGroupNameSnapshot: group.name,
    modifierOptionNameSnapshot: option.name,
    priceDeltaCents: option.priceDeltaCents,
    quantity: 1,
  });
  const line = (item, quantity, modifiers, specialInstructions = null) => {
    const perUnitModifiers = modifiers.reduce((sum, entry) => sum + entry.priceDeltaCents, 0);
    return {
      menuItemId: item.id,
      menuItemNameSnapshot: item.name,
      menuItemDescriptionSnapshot: item.description,
      quantity,
      unitPriceCents: item.priceCents,
      modifiersTotalCents: perUnitModifiers * quantity,
      lineSubtotalCents: (item.priceCents + perUnitModifiers) * quantity,
      specialInstructions,
      modifiers,
    };
  };

  return [
    [
      line(menu.generalTao, 1, [modifier(menu.spice, menu.medium), modifier(menu.extras, menu.extraRice)]),
      line(menu.dumplings, 1, [modifier(menu.extras, menu.extraSauce)]),
    ],
    [line(menu.sushi, 2, [modifier(menu.extras, menu.springRoll)], "Sauce soya à part, s.v.p.")],
    [
      line(menu.generalTao, 1, [modifier(menu.spice, menu.spicy), modifier(menu.extras, menu.springRoll)]),
      line(menu.dumplings, 2, [], "Bien grillés."),
    ],
    [
      line(menu.sushi, 1, [modifier(menu.extras, menu.extraSauce)]),
      line(menu.generalTao, 1, [modifier(menu.spice, menu.mild)], "Sans oignons."),
    ],
  ];
}

function menuLookup(menuItems) {
  const item = (name) => {
    const value = menuItems.find((candidate) => candidate.name === name);
    if (!value) throw new Error(`Required menu item is missing: ${name}`);
    return value;
  };
  const generalTao = item("General Tao Chicken Combo");
  const sushi = item("Sushi Lunch Box");
  const dumplings = item("Pork Dumplings");
  const assignments = [...generalTao.modifierGroups, ...sushi.modifierGroups, ...dumplings.modifierGroups];
  const group = (name) => {
    const value = assignments.find((candidate) => candidate.modifierGroup.name === name)?.modifierGroup;
    if (!value) throw new Error(`Required modifier group is missing: ${name}`);
    return value;
  };
  const spice = group("Spice level");
  const extras = group("Extras");
  const option = (source, name) => {
    const value = source.options.find((candidate) => candidate.name === name);
    if (!value) throw new Error(`Required modifier option is missing: ${name}`);
    return value;
  };
  return {
    generalTao,
    sushi,
    dumplings,
    spice,
    extras,
    mild: option(spice, "Mild"),
    medium: option(spice, "Medium"),
    spicy: option(spice, "Spicy"),
    extraSauce: option(extras, "Extra sauce"),
    extraRice: option(extras, "Extra rice"),
    springRoll: option(extras, "Spring roll"),
  };
}

async function main() {
  assertSafeDemoTarget();
  const now = new Date();
  const stamp = serviceDateStamp(now);
  const reservationBefore = await prisma.reservation.aggregate({
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  const menuItems = await prisma.menuItem.findMany({
    where: { isActive: true },
    include: {
      modifierGroups: {
        include: { modifierGroup: { include: { options: true } } },
      },
    },
  });
  const menu = menuLookup(menuItems);
  const carts = buildCartVariants(menu);
  const activeDriver = await prisma.driver.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!activeDriver) throw new Error("At least one active driver is required for demo runs.");

  const summary = await prisma.$transaction(
    async (tx) => {
      const oldOrders = await tx.order.findMany({
        select: {
          id: true,
          orderNumber: true,
          payments: { select: { id: true, providerPaymentId: true } },
        },
      });
      const oldOrderIds = oldOrders.map((order) => order.id);
      const oldOrderNumbers = oldOrders.map((order) => order.orderNumber);
      const oldPayments = oldOrders.flatMap((order) => order.payments);
      const oldPaymentIds = oldPayments.map((payment) => payment.id);
      const oldProviderPaymentIds = oldPayments
        .map((payment) => payment.providerPaymentId)
        .filter((value) => value !== null);
      const oldRuns = await tx.deliveryRun.findMany({ select: { id: true } });
      const oldRunIds = oldRuns.map((run) => run.id);

      // Audit rows are immutable during normal application operation. A full demo reset
      // must remove the synthetic history attached to the synthetic orders, so disable
      // only the two audit-delete triggers inside this transaction. PostgreSQL rolls the
      // trigger state back automatically if any later reset or seed statement fails.
      await tx.$executeRawUnsafe(
        'ALTER TABLE "OrderEvent" DISABLE TRIGGER "OrderEvent_immutable"',
      );
      await tx.$executeRawUnsafe(
        'ALTER TABLE "OperationalAuditEvent" DISABLE TRIGGER "OperationalAuditEvent_immutable"',
      );
      await tx.refundIntent.deleteMany({});
      await tx.paymentWebhookEvent.deleteMany({
        where: {
          OR: [
            { paymentId: { in: oldPaymentIds } },
            { providerPaymentId: { in: oldProviderPaymentIds } },
          ],
        },
      });
      await tx.notification.deleteMany({ where: { orderId: { in: oldOrderIds } } });
      await tx.reconciliationVariance.deleteMany({ where: { orderId: { in: oldOrderIds } } });
      await tx.operationalAlert.deleteMany({
        where: {
          OR: [
            { orderNumber: { in: oldOrderNumbers } },
            { entityType: "Order", entityId: { in: oldOrderIds } },
            { entityType: "Payment", entityId: { in: oldPaymentIds } },
            { entityType: "DeliveryRun", entityId: { in: oldRunIds } },
          ],
        },
      });
      await tx.operationalAuditEvent.deleteMany({
        where: {
          OR: [
            { entityType: "Order", entityId: { in: oldOrderIds } },
            { entityType: "Payment", entityId: { in: oldPaymentIds } },
            { entityType: "DeliveryRun", entityId: { in: oldRunIds } },
          ],
        },
      });
      await tx.deliveryRun.deleteMany({});
      await tx.order.deleteMany({});
      await tx.$executeRawUnsafe(
        'ALTER TABLE "OrderEvent" ENABLE TRIGGER "OrderEvent_immutable"',
      );
      await tx.$executeRawUnsafe(
        'ALTER TABLE "OperationalAuditEvent" ENABLE TRIGGER "OperationalAuditEvent_immutable"',
      );
      await tx.customer.deleteMany({ where: { id: { startsWith: "demo-customer-" } } });

      await tx.restaurantOrderSettings.upsert({
        where: { id: 1 },
        update: {
          restaurantLatitude: RESTAURANT_LATITUDE,
          restaurantLongitude: RESTAURANT_LONGITUDE,
          dispatchMaxWaitMinutes: 10,
          dispatchDeadlineBufferMinutes: 20,
          dispatchLowDemandReleaseCount: 2,
        },
        create: {
          id: 1,
          onlineOrderingEnabled: false,
          deliveryEnabled: false,
          restaurantLatitude: RESTAURANT_LATITUDE,
          restaurantLongitude: RESTAURANT_LONGITUDE,
          dispatchMaxWaitMinutes: 10,
          dispatchDeadlineBufferMinutes: 20,
          dispatchLowDemandReleaseCount: 2,
        },
      });
      await tx.deliveryZone.upsert({
        where: { id: DEMO_ZONE_ID },
        update: {
          name: "Châteauguay Demo Zone",
          isActive: true,
          centerLatitude: RESTAURANT_LATITUDE,
          centerLongitude: RESTAURANT_LONGITUDE,
          radiusKm: 8,
          deliveryFeeCents: 499,
          minimumOrderCents: 2500,
          freeDeliveryThresholdCents: 6000,
          sortOrder: 10,
        },
        create: {
          id: DEMO_ZONE_ID,
          name: "Châteauguay Demo Zone",
          centerLatitude: RESTAURANT_LATITUDE,
          centerLongitude: RESTAURANT_LONGITUDE,
          radiusKm: 8,
          deliveryFeeCents: 499,
          minimumOrderCents: 2500,
          freeDeliveryThresholdCents: 6000,
          sortOrder: 10,
        },
      });
      await tx.driverZoneEligibility.upsert({
        where: {
          driverId_deliveryZoneId: {
            driverId: activeDriver.id,
            deliveryZoneId: DEMO_ZONE_ID,
          },
        },
        update: { isActive: true },
        create: {
          driverId: activeDriver.id,
          deliveryZoneId: DEMO_ZONE_ID,
          isActive: true,
        },
      });
      await tx.driverShift.upsert({
        where: { id: DEMO_SHIFT_ID },
        update: {
          driverId: activeDriver.id,
          startsAt: minutesFrom(now, -120),
          endsAt: minutesFrom(now, 600),
          isActive: true,
        },
        create: {
          id: DEMO_SHIFT_ID,
          driverId: activeDriver.id,
          startsAt: minutesFrom(now, -120),
          endsAt: minutesFrom(now, 600),
          isActive: true,
        },
      });

      const customerRows = [];
      for (const [index, customer] of customers.entries()) {
        const [name, addressLine1, postalCode, latitude, longitude, deliveryInstructions] = customer;
        const id = `demo-customer-${String(index + 1).padStart(2, "0")}`;
        const row = await tx.customer.create({
          data: {
            id,
            name: `[DÉMO] ${name}`,
            phone: `+1514555${String(1000 + index).slice(-4)}`,
            email: `demo.customer.${index + 1}@example.test`,
            language: index % 3 === 0 ? "EN" : "FR",
            addresses: {
              create: {
                id: `${id}-address`,
                label: "Adresse de démonstration",
                addressLine1,
                city: "Châteauguay",
                province: "QC",
                postalCode,
                country: "CA",
                latitude,
                longitude,
                deliveryInstructions,
              },
            },
          },
          include: { addresses: true },
        });
        customerRows.push(row);
      }

      const createdByStage = new Map();
      let sequence = 1001;
      for (const [stageIndex, stage] of orderStageDefinitions().entries()) {
        const stageOrders = [];
        for (let position = 0; position < 4; position += 1) {
          const orderIndex = stageIndex * 4 + position;
          const orderId = `demo-order-${String(orderIndex + 1).padStart(3, "0")}`;
          const orderNumber = `BP-${stamp}-${sequence}`;
          sequence += 1;
          const customer = customerRows[orderIndex % customerRows.length];
          const address = customer.addresses[0];
          const items = carts[orderIndex % carts.length];
          const itemsSubtotalCents = items.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
          const taxes = taxFor(itemsSubtotalCents);
          const deliveryFeeCents = itemsSubtotalCents >= 6000 ? 0 : 499;
          const tipCents = Math.round(itemsSubtotalCents * [0.1, 0.12, 0.15, 0][position]);
          const totalCents = itemsSubtotalCents + taxes.taxCents + deliveryFeeCents + tipCents;
          const createdAt = minutesFrom(now, -(15 - position));
          const isRefunded = stage.key === "REFUNDED";
          const paymentStatus = isRefunded ? OrderPaymentStatus.REFUNDED : OrderPaymentStatus.PAID;
          const refundStatus = isRefunded ? OrderRefundStatus.SUCCEEDED : OrderRefundStatus.NOT_REQUIRED;
          const state = stageState(stage.key);
          const timestamps = stageTimestamps(stage.key, createdAt);
          const distanceKm = Number(
            Math.hypot(
              (address.latitude - RESTAURANT_LATITUDE) * 111,
              (address.longitude - RESTAURANT_LONGITUDE) * 78,
            ).toFixed(1),
          );

          const order = await tx.order.create({
            data: {
              id: orderId,
              publicCode: `DEMO${stamp}${String(orderIndex + 1).padStart(3, "0")}`,
              trackingToken: crypto.createHash("sha256").update(`buffet-pin-demo-${stamp}-${orderIndex + 1}`).digest("hex"),
              orderNumber,
              serviceType: OrderServiceType.DELIVERY,
              paymentStatus,
              refundStatus,
              ...state,
              customerId: customer.id,
              customerAddressId: address.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              customerEmail: customer.email,
              deliveryAddressLine1: address.addressLine1,
              deliveryAddressLine2: address.addressLine2,
              deliveryCity: address.city,
              deliveryProvince: address.province,
              deliveryPostalCode: address.postalCode,
              deliveryCountry: address.country,
              deliveryLatitude: address.latitude,
              deliveryLongitude: address.longitude,
              deliveryDistanceKm: distanceKm,
              deliveryZoneIdSnapshot: DEMO_ZONE_ID,
              deliveryZoneNameSnapshot: "Châteauguay Demo Zone",
              deliveryInstructions: address.deliveryInstructions,
              isAsap: true,
              estimatedReadyStartAt: minutesFrom(createdAt, 25),
              estimatedReadyEndAt: minutesFrom(createdAt, 35),
              estimatedDeliveryStartAt: minutesFrom(createdAt, 45),
              estimatedDeliveryEndAt: minutesFrom(createdAt, 65),
              promisedDeliveryStartAt: minutesFrom(now, 35 + position * 5),
              promisedDeliveryEndAt: minutesFrom(now, 75 + position * 5),
              dispatchDeadlineAt: minutesFrom(now, 25 + position * 4),
              itemsSubtotalCents,
              taxableSubtotalCents: itemsSubtotalCents,
              ...taxes,
              tipCents,
              deliveryFeeCents,
              totalCents,
              currency: "CAD",
              customerNotes: position % 2 === 0 ? "Merci de vérifier les sauces et les ustensiles." : null,
              internalNotes: `${DEMO_NOTE} Scenario: ${stage.label}.`,
              ...(isRefunded ? { rejectionReason: "Synthetic customer cancellation for demo history." } : {}),
              ...timestamps,
              createdAt,
              updatedAt: minutesFrom(createdAt, 2),
              items: {
                create: items.map((item, itemIndex) => ({
                  ...item,
                  sortOrder: itemIndex,
                  modifiers: { create: item.modifiers },
                })),
              },
              payments: {
                create: {
                  provider: PaymentProvider.CLOVER,
                  status: paymentStatus,
                  refundStatus,
                  amountCents: totalCents,
                  refundedAmountCents: isRefunded ? totalCents : 0,
                  currency: "CAD",
                  providerIdempotencyKey: `demo-payment-${stamp}-${orderIndex + 1}`,
                  providerPaymentId: `DEMO-PAY-${stamp}-${String(orderIndex + 1).padStart(3, "0")}`,
                  providerOrderId: `DEMO-CLOVER-ORDER-${stamp}-${String(orderIndex + 1).padStart(3, "0")}`,
                  paidAt: minutesFrom(createdAt, 1),
                  ...(isRefunded
                    ? { refundRequestedAt: minutesFrom(createdAt, 4), refundedAt: minutesFrom(createdAt, 5) }
                    : {}),
                  rawProviderData: { fixture: true, sanitized: true, source: "seed-demo-orders" },
                  createdAt,
                  updatedAt: isRefunded ? minutesFrom(createdAt, 5) : minutesFrom(createdAt, 1),
                },
              },
              externalOrders: {
                create: {
                  provider: PaymentProvider.CLOVER,
                  providerOrderId: `DEMO-CLOVER-ORDER-${stamp}-${String(orderIndex + 1).padStart(3, "0")}`,
                  state: "CONFIRMED",
                  requestKey: `demo-external-order-${stamp}-${orderIndex + 1}`,
                  sanitizedData: { fixture: true, orderNumber, totalCents },
                  createdAt,
                  updatedAt: minutesFrom(createdAt, 1),
                },
              },
              printJobs: {
                create: {
                  initialForOrderId: orderId,
                  purpose: PrintJobPurpose.INITIAL,
                  status: PrintJobStatus.PRINTED,
                  idempotencyKey: `demo-initial-print-${stamp}-${orderIndex + 1}`,
                  providerPrintEventId: `DEMO-PRINT-${stamp}-${String(orderIndex + 1).padStart(3, "0")}`,
                  attempts: 1,
                  requestedByActorType: OrderActorType.SYSTEM,
                  requestedByActorId: "demo-seeder",
                  requestedByLabel: "Demo data seeder",
                  sanitizedRequest: { fixture: true, orderNumber },
                  sanitizedObservation: { fixture: true, status: "PRINTED" },
                  submittedAt: minutesFrom(createdAt, 1),
                  observedAt: minutesFrom(createdAt, 1.5),
                  resolvedAt: minutesFrom(createdAt, 1.5),
                  createdAt,
                  updatedAt: minutesFrom(createdAt, 1.5),
                },
              },
              events: { create: eventHistory(stage.key, createdAt) },
            },
            include: { items: true, payments: true },
          });

          if (["PACKED", "DESK", "RUN_APPROVED", "RUN_READY", "COMPLETED"].includes(stage.key)) {
            await tx.packingCheck.createMany({
              data: order.items.map((item) => ({
                orderId: order.id,
                orderItemId: item.id,
                expectedQuantity: item.quantity,
                verifiedQuantity: item.quantity,
                instructionsAcknowledged: true,
                actorId: "demo-operator",
                actorLabel: "Demo Operator",
                verifiedAt: minutesFrom(createdAt, 7),
                createdAt: minutesFrom(createdAt, 7),
                updatedAt: minutesFrom(createdAt, 7),
              })),
            });
          }

          if (isRefunded) {
            const payment = order.payments[0];
            await tx.refundIntent.create({
              data: {
                requestKey: `demo-refund-${stamp}-${orderIndex + 1}`,
                orderId: order.id,
                paymentId: payment.id,
                status: RefundIntentStatus.SUCCEEDED,
                amountCents: totalCents,
                currency: "CAD",
                reason: "Synthetic completed refund for demo history.",
                actorId: "demo-manager",
                actorLabel: "Demo Manager",
                providerRefundId: `DEMO-REFUND-${stamp}-${String(orderIndex + 1).padStart(3, "0")}`,
                providerIdempotencyKey: `demo-refund-provider-${stamp}-${orderIndex + 1}`,
                attemptCount: 1,
                requestPayload: { fixture: true, amountCents: totalCents },
                providerResponse: { fixture: true, status: "succeeded" },
                submittedAt: minutesFrom(createdAt, 4),
                lastAttemptAt: minutesFrom(createdAt, 4),
                resolvedAt: minutesFrom(createdAt, 5),
                createdAt: minutesFrom(createdAt, 4),
                updatedAt: minutesFrom(createdAt, 5),
              },
            });
          }

          stageOrders.push(order);
        }
        createdByStage.set(stage.key, stageOrders);
      }

      const approvedOrders = createdByStage.get("RUN_APPROVED");
      const readyOrders = createdByStage.get("RUN_READY");
      const completedOrders = createdByStage.get("COMPLETED");
      await tx.deliveryRun.create({
        data: {
          id: "demo-run-approved",
          runNumber: `RUN-${stamp}-A01`,
          requestKey: `demo-run-approved-${stamp}`,
          status: DeliveryRunStatus.APPROVED,
          zoneIdSnapshot: DEMO_ZONE_ID,
          zoneNameSnapshot: "Châteauguay Demo Zone",
          driverId: activeDriver.id,
          approvedByActorId: "demo-dispatcher",
          approvedByActorLabel: "Demo Dispatcher",
          routeExplanation: "Synthetic same-zone four-stop run ready for bag verification.",
          routingStatus: "MANUAL_FALLBACK",
          estimatedDurationSeconds: 1680,
          estimatedDistanceMeters: 14200,
          approvedAt: minutesFrom(now, -5),
          stops: {
            create: approvedOrders.map((order, index) => ({
              orderId: order.id,
              position: index + 1,
              status: DeliveryStopStatus.PLANNED,
              etaAt: minutesFrom(now, 35 + index * 10),
            })),
          },
        },
      });
      await tx.deliveryRun.create({
        data: {
          id: "demo-run-ready",
          runNumber: `RUN-${stamp}-R01`,
          requestKey: `demo-run-ready-${stamp}`,
          status: DeliveryRunStatus.READY,
          zoneIdSnapshot: DEMO_ZONE_ID,
          zoneNameSnapshot: "Châteauguay Demo Zone",
          driverId: activeDriver.id,
          approvedByActorId: "demo-dispatcher",
          approvedByActorLabel: "Demo Dispatcher",
          routeExplanation: "Synthetic four-stop manifest ready for driver pickup verification.",
          routingStatus: "MANUAL_FALLBACK",
          estimatedDurationSeconds: 1740,
          estimatedDistanceMeters: 15100,
          approvedAt: minutesFrom(now, -8),
          stops: {
            create: readyOrders.map((order, index) => ({
              orderId: order.id,
              position: index + 1,
              status: DeliveryStopStatus.BAG_VERIFIED,
              etaAt: minutesFrom(now, 30 + index * 10),
              bagVerifiedAt: minutesFrom(now, -2),
              bagVerifiedBy: "demo-dispatcher",
            })),
          },
        },
      });
      await tx.deliveryRun.create({
        data: {
          id: "demo-run-completed",
          runNumber: `RUN-${stamp}-C01`,
          requestKey: `demo-run-completed-${stamp}`,
          status: DeliveryRunStatus.COMPLETED,
          zoneIdSnapshot: DEMO_ZONE_ID,
          zoneNameSnapshot: "Châteauguay Demo Zone",
          driverId: activeDriver.id,
          approvedByActorId: "demo-dispatcher",
          approvedByActorLabel: "Demo Dispatcher",
          routeExplanation: "Synthetic completed four-stop delivery run for history views.",
          routingStatus: "MANUAL_FALLBACK",
          estimatedDurationSeconds: 1620,
          estimatedDistanceMeters: 13600,
          approvedAt: minutesFrom(now, -75),
          pickedUpAt: minutesFrom(now, -60),
          completedAt: minutesFrom(now, -20),
          stops: {
            create: completedOrders.map((order, index) => ({
              orderId: order.id,
              position: index + 1,
              status: DeliveryStopStatus.DELIVERED,
              etaAt: minutesFrom(now, -50 + index * 10),
              bagVerifiedAt: minutesFrom(now, -65),
              bagVerifiedBy: "demo-dispatcher",
              pickedUpAt: minutesFrom(now, -60),
              deliveredAt: minutesFrom(now, -50 + index * 10),
            })),
          },
        },
      });

      return {
        removedOrders: oldOrders.length,
        createdOrders: [...createdByStage.values()].reduce((sum, orders) => sum + orders.length, 0),
        driver: activeDriver.name,
        stageCounts: Object.fromEntries(
          [...createdByStage.entries()].map(([stage, orders]) => [stage, orders.length]),
        ),
      };
    },
    { maxWait: 15_000, timeout: 120_000 },
  );

  const [reservationAfter, orderGroups, runs, printedOrders, paidOrders, demoOrders] = await Promise.all([
    prisma.reservation.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.order.groupBy({
      by: ["productionStatus", "dispatchStatus", "fulfillmentStatus", "paymentStatus", "refundStatus"],
      _count: { _all: true },
      orderBy: { productionStatus: "asc" },
    }),
    prisma.deliveryRun.findMany({
      orderBy: { runNumber: "asc" },
      select: { runNumber: true, status: true, _count: { select: { stops: true } } },
    }),
    prisma.order.count({
      where: { printJobs: { some: { purpose: PrintJobPurpose.INITIAL, status: PrintJobStatus.PRINTED } } },
    }),
    prisma.order.count({ where: { paymentStatus: { in: [OrderPaymentStatus.PAID, OrderPaymentStatus.REFUNDED] } } }),
    prisma.order.count({ where: { internalNotes: { startsWith: DEMO_NOTE } } }),
  ]);

  const reservationUnchanged =
    reservationBefore._count._all === reservationAfter._count._all &&
    reservationBefore._max.updatedAt?.toISOString() === reservationAfter._max.updatedAt?.toISOString();
  if (!reservationUnchanged) throw new Error("Reservation preservation verification failed.");
  if (summary.createdOrders !== 40 || demoOrders !== 40 || printedOrders !== 40 || paidOrders !== 40) {
    throw new Error("Demo order verification failed: expected 40 complete synthetic order fixtures.");
  }
  if (Object.values(summary.stageCounts).some((count) => count !== 4)) {
    throw new Error("Demo stage verification failed: every stage must contain exactly four orders.");
  }
  if (runs.length !== 3 || runs.some((run) => run._count.stops !== 4)) {
    throw new Error("Demo run verification failed: expected three four-stop runs.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...summary,
        reservations: {
          count: reservationAfter._count._all,
          unchanged: true,
          latestUpdatedAt: reservationAfter._max.updatedAt?.toISOString() ?? null,
        },
        orderGroups,
        runs,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
