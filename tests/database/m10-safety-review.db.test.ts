import { OrderActorType, OrderPaymentStatus, OrderServiceType, PaymentProvider, PrintJobPurpose, PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { claimPaymentWebhookEvent, releaseUnprocessedPaymentWebhookEvent } from "../../lib/clover/webhook-claims";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";
import { observePrintJob, submitPrintJob } from "../../lib/clover/print-orders";
import { abandonFailedCloverOrder, resolveCloverOrderNotCreated, resolveUnknownCloverOrder } from "../../lib/clover/platform-orders";
import { collectOperationalAlertCandidates } from "../../lib/operations/alerts";

const prisma = new PrismaClient({ datasourceUrl: assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL) });
afterAll(() => prisma.$disconnect());

describe("final concurrency safety", () => {
  it("allows only one concurrent processor to claim a provider webhook and permits stale recovery", async () => {
    const event = await prisma.paymentWebhookEvent.create({ data: { provider: PaymentProvider.CLOVER, providerEventId: `claim-${crypto.randomUUID()}`, eventType: "PAYMENT", payload: {} } });
    const claims = await Promise.all(Array.from({ length: 12 }, () => claimPaymentWebhookEvent(prisma, event.id)));
    expect(claims.filter((claim) => claim.status === "CLAIMED")).toHaveLength(1);
    expect(claims.filter((claim) => claim.status === "PROCESSING")).toHaveLength(11);
    const owner = claims.find((claim) => claim.status === "CLAIMED")!;
    await releaseUnprocessedPaymentWebhookEvent(prisma, event.id, owner.token!);
    await expect(claimPaymentWebhookEvent(prisma, event.id)).resolves.toMatchObject({ status: "CLAIMED" });
    await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { processingStartedAt: null, processedAt: new Date() } });
    await expect(claimPaymentWebhookEvent(prisma, event.id)).resolves.toMatchObject({ status: "PROCESSED" });

    const recovery = await prisma.paymentWebhookEvent.create({ data: { provider: PaymentProvider.CLOVER, providerEventId: `recovery-${crypto.randomUUID()}`, eventType: "PAYMENT", payload: {} } });
    const first = await claimPaymentWebhookEvent(prisma, recovery.id, new Date("2026-07-22T10:00:00Z"));
    const second = await claimPaymentWebhookEvent(prisma, recovery.id, new Date("2026-07-22T10:06:00Z"));
    expect(first.status).toBe("CLAIMED");
    expect(second.status).toBe("CLAIMED");
    await releaseUnprocessedPaymentWebhookEvent(prisma, recovery.id, first.token!);
    expect(await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: recovery.id } })).toMatchObject({ processingToken: second.token });
  });

  it("records immutable print submission transitions and surfaces failed Clover order intents", async () => {
    const suffix = crypto.randomUUID();
    const numberBase = 1000 + (Number.parseInt(suffix.slice(0, 6), 16) % 8000);
    const customer = await prisma.customer.create({ data: { name: "Safety", phone: `+1${Date.now().toString().slice(-10)}` } });
    const order = await prisma.order.create({ data: { publicCode: `SAFE${suffix}`.replaceAll("-", "").slice(0, 24), trackingToken: `tracking-${suffix}`, orderNumber: `BP-260722-${numberBase.toString().padStart(4, "0")}`, serviceType: OrderServiceType.DELIVERY, paymentStatus: OrderPaymentStatus.PAID, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, itemsSubtotalCents: 1000, taxableSubtotalCents: 1000, taxCents: 150, totalCents: 1150 } });
    await prisma.externalOrder.create({ data: { orderId: order.id, provider: PaymentProvider.CLOVER, providerOrderId: `clover-${suffix}`, state: "CREATED", requestKey: `external-${suffix}` } });
    const job = await prisma.printJob.create({ data: { orderId: order.id, initialForOrderId: order.id, purpose: PrintJobPurpose.INITIAL, idempotencyKey: `print-${suffix}`, requestedByActorType: OrderActorType.SYSTEM } });
    const client = {
      config: { merchantId: "merchant" },
      post: async () => ({ id: `event-${suffix}`, state: "CREATED" }),
      get: async () => ({ id: `event-${suffix}`, state: "CREATED" }),
    } as unknown as Parameters<typeof submitPrintJob>[1];
    await expect(submitPrintJob(job.id, client)).resolves.toMatchObject({ status: "SUBMITTED" });
    expect(await prisma.orderEvent.count({ where: { orderId: order.id, eventType: { in: ["KITCHEN_PRINT_SUBMISSION_STARTED", "KITCHEN_PRINT_SUBMITTED"] } } })).toBe(2);
    await prisma.printJob.update({ where: { id: job.id }, data: { status: "PRINTING" } });
    await expect(observePrintJob(job.id, client)).resolves.toMatchObject({ status: "PRINTING" });
    await prisma.printJob.update({ where: { id: job.id }, data: { status: "PRINTED" } });
    await expect(observePrintJob(job.id, client)).resolves.toMatchObject({ status: "PRINTED" });
    await prisma.printJob.update({ where: { id: job.id }, data: { status: "PENDING", providerPrintEventId: null } });
    const lateSubmitClient = {
      config: { merchantId: "merchant" },
      post: async () => {
        await prisma.printJob.update({ where: { id: job.id }, data: { status: "PRINTED" } });
        return { id: `late-event-${suffix}`, state: "CREATED" };
      },
    } as unknown as Parameters<typeof submitPrintJob>[1];
    await expect(submitPrintJob(job.id, lateSubmitClient)).resolves.toMatchObject({ status: "PRINTED" });
    expect(await prisma.orderEvent.count({ where: { orderId: order.id, eventType: "KITCHEN_PRINT_LATE_SUBMISSION_RESULT_IGNORED" } })).toBe(1);

    const failedOrder = await prisma.order.create({ data: { publicCode: `FAIL${suffix}`.replaceAll("-", "").slice(0, 24), trackingToken: `failed-tracking-${suffix}`, orderNumber: `BP-260722-${(numberBase + 1).toString().padStart(4, "0")}`, serviceType: OrderServiceType.DELIVERY, paymentStatus: OrderPaymentStatus.FAILED, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, itemsSubtotalCents: 1000, taxableSubtotalCents: 1000, taxCents: 150, totalCents: 1150 } });
    await prisma.payment.create({ data: { orderId: failedOrder.id, provider: PaymentProvider.CLOVER, status: OrderPaymentStatus.FAILED, amountCents: 1150, providerIdempotencyKey: `failed-payment-${suffix}` } });
    const failedIntent = await prisma.externalOrder.create({ data: { orderId: failedOrder.id, provider: PaymentProvider.CLOVER, state: "FAILED", requestKey: `failed-external-${suffix}` } });
    const candidates = await collectOperationalAlertCandidates();
    expect(candidates).toContainEqual(expect.objectContaining({ alertKey: `external-order:${failedIntent.id}`, category: "EXTERNAL_ORDER_EXCEPTION" }));
    await expect(abandonFailedCloverOrder({ externalOrderId: failedIntent.id, actorId: "manager-1", reason: "Known unpaid checkout; customer was instructed to restart." })).resolves.toMatchObject({ state: "ABANDONED" });
  });

  it("expires stale Clover-order submissions to UNKNOWN and requires provider-verified recovery", async () => {
    const suffix = crypto.randomUUID();
    const numberBase = 1000 + (Number.parseInt(suffix.slice(0, 6), 16) % 8000);
    const customer = await prisma.customer.create({ data: { name: "Recovery", phone: `+2${Date.now().toString().slice(-10)}` } });
    const order = await prisma.order.create({
      data: {
        publicCode: `REC${suffix}`.replaceAll("-", "").slice(0, 24),
        trackingToken: `recovery-tracking-${suffix}`,
        orderNumber: `BP-260722-${numberBase.toString().padStart(4, "0")}`,
        serviceType: OrderServiceType.DELIVERY,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        itemsSubtotalCents: 1_000,
        taxableSubtotalCents: 1_000,
        taxCents: 150,
        tipCents: 200,
        totalCents: 1_350,
      },
    });
    const intent = await prisma.externalOrder.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.CLOVER,
        state: "PENDING",
        requestKey: `recovery-${suffix}`,
        submissionToken: `claim-${suffix}`,
        submissionStartedAt: new Date("2026-07-22T09:00:00Z"),
      },
    });
    await prisma.payment.create({ data: { orderId: order.id, provider: PaymentProvider.CLOVER, status: OrderPaymentStatus.PENDING, amountCents: 1_350, providerIdempotencyKey: `recovery-payment-${suffix}` } });

    const candidates = await collectOperationalAlertCandidates(new Date("2026-07-22T09:06:00Z"));
    expect(candidates).toContainEqual(expect.objectContaining({ alertKey: `external-order:${intent.id}` }));
    expect(await prisma.externalOrder.findUniqueOrThrow({ where: { id: intent.id } })).toMatchObject({ state: "UNKNOWN", submissionToken: null });
    expect(await prisma.orderEvent.count({ where: { orderId: order.id, eventType: "CLOVER_ORDER_SUBMISSION_LEASE_EXPIRED_UNKNOWN" } })).toBe(1);

    const client = {
      config: { merchantId: "merchant" },
      get: async () => ({ id: `provider-${suffix}`, total: 1_150, note: `Buffet Pin delivery ${order.orderNumber}` }),
    } as unknown as NonNullable<Parameters<typeof resolveUnknownCloverOrder>[0]["client"]>;
    const unrelatedClient = {
      config: { merchantId: "merchant" },
      get: async () => ({ id: `provider-${suffix}`, total: 1_150, note: "Buffet Pin delivery BP-260722-9999" }),
    } as unknown as NonNullable<Parameters<typeof resolveUnknownCloverOrder>[0]["client"]>;
    await expect(resolveUnknownCloverOrder({
      externalOrderId: intent.id,
      providerOrderId: `provider-${suffix}`,
      actorId: "manager-1",
      evidence: { verificationMethod: "CLOVER_API", observedAt: "2026-07-22T09:07:00Z", note: "Attempted same-total unrelated order." },
      client: unrelatedClient,
    })).rejects.toThrow("operational order number");
    await expect(resolveUnknownCloverOrder({
      externalOrderId: intent.id,
      providerOrderId: `provider-${suffix}`,
      actorId: "manager-1",
      evidence: { verificationMethod: "CLOVER_API", observedAt: "2026-07-22T09:07:00Z", note: "Verified through the Clover Orders API." },
      client,
    })).resolves.toMatchObject({ state: "CREATED", providerOrderId: `provider-${suffix}` });
    expect(await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } })).toMatchObject({ status: OrderPaymentStatus.FAILED, failureCode: "CLOVER_ORDER_RECOVERED_UNPAID_RESTART_REQUIRED" });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ paymentStatus: OrderPaymentStatus.FAILED });
    await expect(resolveUnknownCloverOrder({
      externalOrderId: intent.id,
      providerOrderId: `provider-${suffix}`,
      actorId: "manager-1",
      evidence: { verificationMethod: "CLOVER_API", observedAt: "2026-07-22T09:08:00Z", note: "Duplicate recovery attempt." },
      client,
    })).rejects.toThrow("External order is not unresolved");

    const compatibilityOrder = await prisma.order.create({
      data: {
        publicCode: `LEG${suffix}`.replaceAll("-", "").slice(0, 24),
        trackingToken: `legacy-tracking-${suffix}`,
        orderNumber: `BP-260722-${(numberBase + 1).toString().padStart(4, "0")}`,
        serviceType: OrderServiceType.DELIVERY,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        itemsSubtotalCents: 1_000,
        taxableSubtotalCents: 1_000,
        taxCents: 150,
        totalCents: 1_150,
      },
    });
    const compatibilityIntent = await prisma.externalOrder.create({
      data: {
        orderId: compatibilityOrder.id,
        provider: PaymentProvider.CLOVER,
        state: "PENDING",
        requestKey: `legacy-recovery-${suffix}`,
        submissionToken: null,
        submissionStartedAt: null,
        updatedAt: new Date("2026-07-22T08:00:00Z"),
      },
    });
    await prisma.payment.create({ data: { orderId: compatibilityOrder.id, provider: PaymentProvider.CLOVER, status: OrderPaymentStatus.PENDING, amountCents: 1_150, providerIdempotencyKey: `legacy-payment-${suffix}` } });
    await collectOperationalAlertCandidates(new Date("2026-07-22T09:06:00Z"));
    expect(await prisma.externalOrder.findUniqueOrThrow({ where: { id: compatibilityIntent.id } })).toMatchObject({ state: "UNKNOWN" });
    await expect(resolveCloverOrderNotCreated({
      externalOrderId: compatibilityIntent.id,
      actorId: "manager-1",
      evidence: { verificationMethod: "CLOVER_DASHBOARD", observedAt: "2026-07-22T09:10:00Z", note: "Verified no matching order in Clover Dashboard." },
    })).resolves.toMatchObject({ state: "FAILED" });
    expect(await prisma.payment.findFirstOrThrow({ where: { orderId: compatibilityOrder.id } })).toMatchObject({ status: OrderPaymentStatus.FAILED, failureCode: "CLOVER_ORDER_CONFIRMED_NOT_CREATED_RESTART_REQUIRED" });
    await expect(abandonFailedCloverOrder({ externalOrderId: compatibilityIntent.id, actorId: "manager-1", reason: "Confirmed unpaid not-created checkout; customer must restart." })).resolves.toMatchObject({ state: "ABANDONED" });
  });
});
