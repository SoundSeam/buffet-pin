import { NotificationStatus, OrderActorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliverNotification } from "@/lib/orders/notifications";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("RETRY"),
    requestKey: z.string().trim().min(8).max(200),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal("REPLACE_UNKNOWN"),
    requestKey: z.string().trim().min(8).max(200),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal("RECONCILE_SENT"),
    providerMessageId: z.string().trim().min(3).max(100),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal("RECONCILE_FAILED"),
    reason: z.string().trim().min(1).max(500),
  }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUserWithAnyCapability([
    "SETTINGS_WRITE",
    "DEV_TOOLS",
  ]);
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR" } },
      { status: 400 },
    );
  const id = (await params).id;
  const notification = await db.notification.findUnique({ where: { id } });
  if (!notification)
    return NextResponse.json(
      { ok: false, error: { code: "NOTIFICATION_NOT_FOUND" } },
      { status: 404 },
    );
  const data = parsed.data;

  if (data.action === "RECONCILE_SENT" || data.action === "RECONCILE_FAILED") {
    if (notification.status !== NotificationStatus.UNKNOWN)
      return NextResponse.json(
        { ok: false, error: { code: "NOTIFICATION_NOT_UNKNOWN" } },
        { status: 409 },
      );
    const status =
      data.action === "RECONCILE_SENT"
        ? NotificationStatus.SENT
        : NotificationStatus.FAILED;
    const updated = await db.$transaction(async (tx) => {
      const changed = await tx.notification.updateMany({
        where: { id, status: NotificationStatus.UNKNOWN },
        data: {
          status,
          ...(data.action === "RECONCILE_SENT"
            ? {
                providerMessageId: data.providerMessageId,
                sentAt: new Date(),
                failedAt: null,
                errorMessage: null,
              }
            : {
                failedAt: new Date(),
                errorMessage: `Manager reconciled as failed: ${data.reason}`,
              }),
        },
      });
      if (changed.count !== 1)
        throw new Error("Notification changed while it was being reconciled.");
      await tx.operationalAuditEvent.create({
        data: {
          actorType: OrderActorType.ADMIN,
          actorId: actor.staff.id,
          actorLabel: actor.staff.displayName,
          eventType: `NOTIFICATION_${data.action}`,
          entityType: "Notification",
          entityId: id,
          reason: data.reason,
          metadata:
            data.action === "RECONCILE_SENT"
              ? { providerMessageId: data.providerMessageId }
              : undefined,
        },
      });
      return tx.notification.findUniqueOrThrow({ where: { id } });
    });
    return NextResponse.json({ ok: true, data: { notification: updated } });
  }

  const replacingUnknown = data.action === "REPLACE_UNKNOWN";
  if (replacingUnknown && notification.status !== NotificationStatus.UNKNOWN)
    return NextResponse.json(
      { ok: false, error: { code: "NOTIFICATION_NOT_UNKNOWN" } },
      { status: 409 },
    );
  if (
    !replacingUnknown &&
    notification.status !== NotificationStatus.PENDING &&
    notification.status !== NotificationStatus.FAILED
  )
    return NextResponse.json(
      {
        ok: false,
        error: {
          code:
            notification.status === NotificationStatus.UNKNOWN
              ? "AMBIGUOUS_NOTIFICATION"
              : "NOTIFICATION_NOT_RETRYABLE",
          message:
            "UNKNOWN notifications require provider reconciliation or a manager-attested replacement.",
        },
      },
      { status: 409 },
    );
  const retryKey = `notification-retry:${data.requestKey}`;
  const retry = await db
    .$transaction(async (tx) => {
      const existing = await tx.notification.findUnique({
        where: { idempotencyKey: retryKey },
      });
      if (existing) {
        const metadata =
          existing.metadata &&
          typeof existing.metadata === "object" &&
          !Array.isArray(existing.metadata)
            ? (existing.metadata as Record<string, unknown>)
            : {};
        if (metadata.parentNotificationId !== notification.id) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }
        return existing;
      }
      const created = await tx.notification.create({
        data: {
          orderId: notification.orderId,
          customerId: notification.customerId,
          recipient: notification.recipient,
          channel: notification.channel,
          templateKey: notification.templateKey,
          idempotencyKey: retryKey,
          body: notification.body,
          provider: notification.provider,
          metadata: {
            parentNotificationId: notification.id,
            retryReason: data.reason,
            managerAttestedUnknownNotAccepted: replacingUnknown,
          },
        },
      });
      await tx.operationalAuditEvent.create({
        data: {
          actorType: OrderActorType.ADMIN,
          actorId: actor.staff.id,
          actorLabel: actor.staff.displayName,
          eventType: replacingUnknown
            ? "UNKNOWN_NOTIFICATION_REPLACEMENT_AUTHORIZED"
            : "NOTIFICATION_RETRY_REQUESTED",
          entityType: "Notification",
          entityId: created.id,
          reason: data.reason,
          metadata: { parentNotificationId: id, requestKey: data.requestKey },
        },
      });
      return created;
    })
    .catch((error) => {
      if (error instanceof Error && error.message === "IDEMPOTENCY_CONFLICT")
        return null;
      throw error;
    });
  if (!retry)
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message:
            "The retry request key was already used for a different notification.",
        },
      },
      { status: 409 },
    );
  const result = await deliverNotification(retry.id, [
    NotificationStatus.PENDING,
    NotificationStatus.FAILED,
  ]);
  return NextResponse.json({ ok: true, data: { notification: result } });
}
