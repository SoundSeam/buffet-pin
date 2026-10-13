import { NextResponse } from "next/server";
import { OrderActorType, Prisma } from "@prisma/client";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().trim().min(1) });
const updateSchema = z.object({
  deliveryFeeCents: z.number().int().min(0).max(20_000),
  minimumOrderCents: z.number().int().min(0).max(200_000),
  freeDeliveryThresholdCents: z.number().int().min(0).max(500_000).nullable(),
  targetDriveMinutes: z.number().int().min(1).max(120),
  reason: z.string().trim().min(12).max(500),
});

class OnlineOrderingEnabledError extends Error {}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getStaffUser("SETTINGS_WRITE");
  if (!actor) {
    return errorResponse(401, "UNAUTHORIZED", "Manager settings permission required.");
  }

  try {
    const { id } = paramsSchema.parse(await params);
    const payload = updateSchema.parse(await request.json());
    await db.restaurantOrderSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });

    const zone = await db.$transaction(async (tx) => {
      const [lockedSettings] = await tx.$queryRaw<
        Array<{ onlineOrderingEnabled: boolean }>
      >`SELECT "onlineOrderingEnabled" FROM "RestaurantOrderSettings" WHERE "id" = 1 FOR UPDATE`;
      if (!lockedSettings || lockedSettings.onlineOrderingEnabled) {
        throw new OnlineOrderingEnabledError();
      }

      const existing = await tx.deliveryZone.findUnique({ where: { id } });
      if (!existing) return null;

      const updated = await tx.deliveryZone.update({
        where: { id },
        data: {
          deliveryFeeCents: payload.deliveryFeeCents,
          minimumOrderCents: payload.minimumOrderCents,
          freeDeliveryThresholdCents: payload.freeDeliveryThresholdCents,
          targetDriveMinutes: payload.targetDriveMinutes,
        },
      });

      await tx.operationalAuditEvent.create({
        data: {
          actorType: OrderActorType.ADMIN,
          actorId: actor.staff.id,
          actorLabel: actor.staff.displayName,
          eventType: "DELIVERY_ZONE_ECONOMICS_UPDATED",
          entityType: "DeliveryZone",
          entityId: updated.id,
          reason: payload.reason,
          metadata: {
            before: {
              deliveryFeeCents: existing.deliveryFeeCents,
              minimumOrderCents: existing.minimumOrderCents,
              freeDeliveryThresholdCents: existing.freeDeliveryThresholdCents,
              targetDriveMinutes: existing.targetDriveMinutes,
            },
            after: {
              deliveryFeeCents: updated.deliveryFeeCents,
              minimumOrderCents: updated.minimumOrderCents,
              freeDeliveryThresholdCents: updated.freeDeliveryThresholdCents,
              targetDriveMinutes: updated.targetDriveMinutes,
            },
          } satisfies Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    if (!zone) return errorResponse(404, "ZONE_NOT_FOUND", "Delivery zone not found.");
    return NextResponse.json({ ok: true, data: { zone } });
  } catch (error) {
    if (error instanceof OnlineOrderingEnabledError) {
      return errorResponse(
        409,
        "ONLINE_ORDERING_MUST_BE_OFF",
        "Turn public online ordering off before changing zone pricing.",
      );
    }
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid delivery-zone values.", error.issues);
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update delivery zone.");
  }
}
