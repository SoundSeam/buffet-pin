import { NotificationChannel, NotificationStatus, PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { deliverNotification } from "../../lib/orders/notifications";
import { assertIsolatedTestDatabaseUrl } from "../../scripts/database-guard.mjs";

const prisma = new PrismaClient({ datasourceUrl: assertIsolatedTestDatabaseUrl(process.env.TEST_DATABASE_URL) });
afterAll(() => prisma.$disconnect());

describe("M8 notification outbox", () => {
  it("claims a pending notification once under concurrency", async () => {
    const notification = await prisma.notification.create({ data: { recipient: "+15555550888", channel: NotificationChannel.SMS, templateKey: "test", idempotencyKey: `notification-${crypto.randomUUID()}`, body: "Test" } });
    const sender = vi.fn().mockResolvedValue({ ok: true, sid: `SM${crypto.randomUUID()}`, status: "queued" });
    const results = await Promise.all(Array.from({ length: 5 }, () => deliverNotification(notification.id, [NotificationStatus.PENDING], sender)));
    expect(sender).toHaveBeenCalledTimes(1);
    expect(results.some((result) => result.status === NotificationStatus.SENT)).toBe(true);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } })).attemptCount).toBe(1);
    expect(await prisma.operationalAuditEvent.count({ where: { entityType: "Notification", entityId: notification.id, eventType: { in: ["NOTIFICATION_SUBMISSION_STARTED", "NOTIFICATION_ACCEPTED_BY_PROVIDER"] } } })).toBe(2);
  });

  it("keeps transport submission ambiguity visible and blocks automatic replay", async () => {
    const notification = await prisma.notification.create({ data: { recipient: "+15555550889", channel: NotificationChannel.SMS, templateKey: "test", idempotencyKey: `notification-${crypto.randomUUID()}`, body: "Test" } });
    const sender = vi.fn().mockResolvedValue({ ok: false, error: new Error("socket closed") });
    const first = await deliverNotification(notification.id, [NotificationStatus.PENDING], sender);
    const replay = await deliverNotification(notification.id, [NotificationStatus.PENDING], sender);
    expect(first.status).toBe(NotificationStatus.UNKNOWN);
    expect(replay.status).toBe(NotificationStatus.UNKNOWN);
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("marks deterministic provider rejection failed while preserving retryable rate limits as unknown", async () => {
    const rejected = await prisma.notification.create({ data: { recipient: "+15555550890", channel: NotificationChannel.SMS, templateKey: "test", idempotencyKey: `notification-${crypto.randomUUID()}`, body: "Test" } });
    const limited = await prisma.notification.create({ data: { recipient: "+15555550891", channel: NotificationChannel.SMS, templateKey: "test", idempotencyKey: `notification-${crypto.randomUUID()}`, body: "Test" } });
    await expect(deliverNotification(rejected.id, [NotificationStatus.PENDING], vi.fn().mockResolvedValue({ ok: false, error: { status: 400, message: "invalid recipient" } }))).resolves.toMatchObject({ status: NotificationStatus.FAILED });
    await expect(deliverNotification(limited.id, [NotificationStatus.PENDING], vi.fn().mockResolvedValue({ ok: false, error: { status: 429, message: "rate limited" } }))).resolves.toMatchObject({ status: NotificationStatus.UNKNOWN });
  });

  it("routes email intents through the email transport with a stable provider idempotency key", async () => {
    const notification = await prisma.notification.create({
      data: {
        recipient: "customer@example.test",
        channel: NotificationChannel.EMAIL,
        templateKey: "order_delivered",
        idempotencyKey: `notification-${crypto.randomUUID()}`,
        body: "Your Buffet PIN order was delivered.",
        provider: "resend",
      },
    });
    const smsSender = vi.fn();
    const emailSender = vi.fn().mockResolvedValue({
      ok: true,
      id: "email-provider-id",
      status: "queued",
    });

    await expect(
      deliverNotification(
        notification.id,
        [NotificationStatus.PENDING],
        smsSender,
        emailSender,
      ),
    ).resolves.toMatchObject({
      status: NotificationStatus.SENT,
      providerMessageId: "email-provider-id",
    });
    expect(smsSender).not.toHaveBeenCalled();
    expect(emailSender).toHaveBeenCalledWith(
      "customer@example.test",
      "Your Buffet PIN order update",
      "Your Buffet PIN order was delivered.",
      notification.id,
    );
  });
});
