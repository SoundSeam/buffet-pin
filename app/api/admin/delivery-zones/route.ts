import { NextResponse } from "next/server";
import { OrderActorType, Prisma } from "@prisma/client";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import {
  BUFFET_PIN_COORDINATES,
  RECOMMENDED_CHATEAUGUAY_ZONES,
} from "@/lib/orders/chateauguay-delivery-zones";
import { getStaffUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const installSchema = z.object({
  action: z.literal("INSTALL_RECOMMENDED_CHATEAUGUAY_ZONES"),
  reason: z.string().trim().min(12).max(500),
});

class OnlineOrderingEnabledError extends Error {}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function GET(request: Request) {
  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  const actor = await getStaffUser(includeInactive ? "SETTINGS_WRITE" : "DISPATCH_WRITE");
  if (!actor) {
    return errorResponse(403, "FORBIDDEN", "Delivery-zone access required.");
  }

  const [zones, settings] = await Promise.all([
    db.deliveryZone.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.restaurantOrderSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      zones,
      recommendedZones: includeInactive ? RECOMMENDED_CHATEAUGUAY_ZONES : undefined,
      restaurant: {
        name: "Buffet Pin",
        address: "90 Boulevard Saint Jean Baptiste #3, Châteauguay, Québec",
        ...BUFFET_PIN_COORDINATES,
      },
      onlineOrderingEnabled: settings.onlineOrderingEnabled,
    },
  });
}

export async function POST(request: Request) {
  const actor = await getStaffUser("SETTINGS_WRITE");
  if (!actor) {
    return errorResponse(401, "UNAUTHORIZED", "Manager settings permission required.");
  }

  try {
    const payload = installSchema.parse(await request.json());
    await db.restaurantOrderSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });

    const keys = RECOMMENDED_CHATEAUGUAY_ZONES.map((zone) => zone.configurationKey);
    const installed = await db.$transaction(async (tx) => {
      const [lockedSettings] = await tx.$queryRaw<
        Array<{ onlineOrderingEnabled: boolean }>
      >`SELECT "onlineOrderingEnabled" FROM "RestaurantOrderSettings" WHERE "id" = 1 FOR UPDATE`;
      if (!lockedSettings || lockedSettings.onlineOrderingEnabled) {
        throw new OnlineOrderingEnabledError();
      }

      await tx.deliveryZone.updateMany({
        where: {
          isActive: true,
          OR: [
            { configurationKey: null },
            { configurationKey: { notIn: keys } },
          ],
        },
        data: { isActive: false },
      });

      const zones = [];
      for (const zone of RECOMMENDED_CHATEAUGUAY_ZONES) {
        zones.push(
          await tx.deliveryZone.upsert({
            where: { configurationKey: zone.configurationKey },
            update: {
              ...zone,
              boundaryGeoJson: zone.boundaryGeoJson as Prisma.InputJsonValue,
              isActive: true,
            },
            create: {
              ...zone,
              boundaryGeoJson: zone.boundaryGeoJson as Prisma.InputJsonValue,
              isActive: true,
            },
          }),
        );
      }

      await tx.restaurantOrderSettings.update({
        where: { id: 1 },
        data: {
          restaurantLatitude: BUFFET_PIN_COORDINATES.latitude,
          restaurantLongitude: BUFFET_PIN_COORDINATES.longitude,
        },
      });

      await tx.operationalAuditEvent.create({
        data: {
          actorType: OrderActorType.ADMIN,
          actorId: actor.staff.id,
          actorLabel: actor.staff.displayName,
          eventType: "DELIVERY_ZONE_PLAN_INSTALLED",
          entityType: "DeliveryZoneConfiguration",
          entityId: "chateauguay-corridors-v1",
          reason: payload.reason,
          metadata: {
            configurationKeys: keys,
            onlineOrderingEnabled: false,
            restaurantCoordinates: BUFFET_PIN_COORDINATES,
          },
        },
      });

      return zones;
    });

    return NextResponse.json({ ok: true, data: { zones: installed } });
  } catch (error) {
    if (error instanceof OnlineOrderingEnabledError) {
      return errorResponse(
        409,
        "ONLINE_ORDERING_MUST_BE_OFF",
        "Turn public online ordering off before replacing delivery coverage.",
      );
    }
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid zone installation request.", error.issues);
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to install delivery zones.");
  }
}
