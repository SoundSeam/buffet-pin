import { NextResponse } from "next/server";
import { OrderActorType } from "@prisma/client";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { getGeocodingConfig } from "@/lib/env";
import { orderSettingsUpdateSchema } from "@/lib/orders/validation";
import { getStaffUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const DEFAULT_ZONE_NAME = "Default delivery radius";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

async function requireAdminResponse() {
  const user = await getStaffUser("SETTINGS_WRITE");
  return user ? null : errorResponse(401, "UNAUTHORIZED", "Admin access required.");
}

async function getSettings() {
  return db.restaurantOrderSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

function serializeSettings(settings: Awaited<ReturnType<typeof getSettings>>) {
  return {
    onlineOrderingEnabled: settings.onlineOrderingEnabled,
    pickupEnabled: settings.pickupEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    restaurantLatitude: settings.restaurantLatitude,
    restaurantLongitude: settings.restaurantLongitude,
    deliveryRadiusKm: settings.deliveryRadiusKm,
    deliveryFeeCents: settings.deliveryFeeCents,
    minimumDeliveryOrderCents: settings.minimumDeliveryOrderCents,
    freeDeliveryThresholdCents: settings.freeDeliveryThresholdCents,
    orderAdminSmsRecipient: settings.orderAdminSmsRecipient,
    busyModeEnabled: settings.busyModeEnabled,
    busyModeExtraMinutes: settings.busyModeExtraMinutes,
    maxActiveOrders: settings.maxActiveOrders,
    acceptanceWindowMinutes: settings.acceptanceWindowMinutes,
    missedAcceptancePauseThreshold: settings.missedAcceptancePauseThreshold,
    missedAcceptanceCount: settings.missedAcceptanceCount,
    intakePausedAt: settings.intakePausedAt?.toISOString() ?? null,
    intakePauseReason: settings.intakePauseReason,
    proofRetentionDays: settings.proofRetentionDays,
    partialRefundsEnabled: settings.partialRefundsEnabled,
    receiptLegalName: settings.receiptLegalName,
    receiptAddress: settings.receiptAddress,
    receiptPhone: settings.receiptPhone,
    receiptTaxRegistration: settings.receiptTaxRegistration,
  };
}

export async function GET() {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const settings = await getSettings();

  return NextResponse.json({ ok: true, data: { settings: serializeSettings(settings) } });
}

export async function PATCH(request: Request) {
  const actor = await getStaffUser("SETTINGS_WRITE");
  if (!actor) return errorResponse(401, "UNAUTHORIZED", "Settings permission required.");

  try {
    const payload = orderSettingsUpdateSchema.parse(await request.json());
    const current = await getSettings();
    const next = {
      ...current,
      ...payload,
    };

    if (next.deliveryEnabled) {
      try {
        getGeocodingConfig(true);
      } catch (error) {
        return errorResponse(
          400,
          "GEOCODING_NOT_CONFIGURED",
          error instanceof Error ? error.message : "Delivery geocoding is not configured.",
        );
      }

      if (
        next.restaurantLatitude === null ||
        next.restaurantLongitude === null ||
        !Number.isFinite(next.restaurantLatitude) ||
        !Number.isFinite(next.restaurantLongitude)
      ) {
        return errorResponse(
          400,
          "DELIVERY_SETTINGS_INCOMPLETE",
          "Restaurant coordinates are required before delivery can be enabled.",
        );
      }
    }

    const settings = await db.$transaction(async (tx) => {
      const updated = await tx.restaurantOrderSettings.upsert({
        where: { id: 1 },
        update: payload,
        create: {
          id: 1,
          ...payload,
        },
      });

      if (
        updated.restaurantLatitude !== null &&
        updated.restaurantLongitude !== null
      ) {
        const polygonZoneCount = await tx.deliveryZone.count({
          where: {
            configurationKey: { not: null },
          },
        });
        const existingZone = await tx.deliveryZone.findFirst({
          where: { name: DEFAULT_ZONE_NAME },
          orderBy: { createdAt: "asc" },
        });
        const zoneData = {
          name: DEFAULT_ZONE_NAME,
          isActive: updated.deliveryEnabled,
          centerLatitude: updated.restaurantLatitude,
          centerLongitude: updated.restaurantLongitude,
          radiusKm: updated.deliveryRadiusKm,
          deliveryFeeCents: updated.deliveryFeeCents,
          minimumOrderCents: updated.minimumDeliveryOrderCents,
          freeDeliveryThresholdCents: updated.freeDeliveryThresholdCents,
          sortOrder: 0,
        };

        if (polygonZoneCount > 0) {
          if (existingZone?.isActive) {
            await tx.deliveryZone.update({
              where: { id: existingZone.id },
              data: { isActive: false },
            });
          }
        } else if (existingZone) {
          await tx.deliveryZone.update({
            where: { id: existingZone.id },
            data: zoneData,
          });
        } else {
          await tx.deliveryZone.create({ data: zoneData });
        }
      }

      await tx.operationalAuditEvent.create({ data: {
        actorType: OrderActorType.ADMIN,
        actorId: actor.staff.id,
        actorLabel: actor.staff.displayName,
        eventType: "ORDER_SETTINGS_UPDATED",
        entityType: "RestaurantOrderSettings",
        entityId: "1",
        metadata: {
          changedFields: Object.keys(payload),
          onlineOrderingEnabled: updated.onlineOrderingEnabled,
          deliveryEnabled: updated.deliveryEnabled,
          busyModeEnabled: updated.busyModeEnabled,
          maxActiveOrders: updated.maxActiveOrders,
        },
      } });

      return updated;
    });

    return NextResponse.json({ ok: true, data: { settings: serializeSettings(settings) } });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid order settings.", error.issues);
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update order settings.");
  }
}
