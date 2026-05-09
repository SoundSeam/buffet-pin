import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { dateOnlyToUtcDate, formatDateOnly, formatSlotTime } from "@/lib/reservations/time";
import { getAdminUser } from "@/lib/supabase/auth";
import { localDateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  slotCapacityGuests: z.coerce.number().int().positive().optional(),
  minPartySize: z.coerce.number().int().positive().optional(),
  maxPartySize: z.coerce.number().int().positive().optional(),
});

const closureSchema = z.object({
  date: localDateSchema,
  note: z.string().trim().max(500).optional().nullable(),
});

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

async function requireAdminResponse() {
  const user = await getAdminUser();
  return user ? null : errorResponse(401, "UNAUTHORIZED", "Admin access required.");
}

function serializeSettings(settings: {
  slotCapacityGuests: number;
  minPartySize: number;
  maxPartySize: number;
  firstSlot: Date;
  lastSlot: Date;
  slotIntervalMinutes: number;
  guestModifyCutoffHours: number;
}) {
  return {
    slotCapacityGuests: settings.slotCapacityGuests,
    minPartySize: settings.minPartySize,
    maxPartySize: settings.maxPartySize,
    firstSlot: formatSlotTime(settings.firstSlot),
    lastSlot: formatSlotTime(settings.lastSlot),
    slotIntervalMinutes: settings.slotIntervalMinutes,
    guestModifyCutoffHours: settings.guestModifyCutoffHours,
  };
}

export async function GET() {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const [settings, closureDates] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    db.closureDate.findMany({ orderBy: { date: "asc" } }),
  ]);

  if (!settings) {
    return errorResponse(500, "SETTINGS_NOT_FOUND", "Reservation settings are not configured.");
  }

  return NextResponse.json({
    ok: true,
    data: {
      settings: serializeSettings(settings),
      closureDates: closureDates.map((closureDate) => ({
        id: closureDate.id,
        date: formatDateOnly(closureDate.date),
        note: closureDate.note,
      })),
    },
  });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  try {
    const payload = settingsSchema.parse(await request.json());
    const current = await db.settings.findUnique({ where: { id: 1 } });

    if (!current) {
      return errorResponse(500, "SETTINGS_NOT_FOUND", "Reservation settings are not configured.");
    }

    const minPartySize = payload.minPartySize ?? current.minPartySize;
    const maxPartySize = payload.maxPartySize ?? current.maxPartySize;

    if (minPartySize > maxPartySize) {
      return errorResponse(400, "INVALID_SETTINGS", "Minimum party size cannot exceed maximum party size.");
    }

    const settings = await db.settings.update({
      where: { id: 1 },
      data: payload,
    });

    return NextResponse.json({ ok: true, data: { settings: serializeSettings(settings) } });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid settings.", error.issues);
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update settings.");
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  try {
    const payload = closureSchema.parse(await request.json());
    const closureDate = await db.closureDate.upsert({
      where: { date: dateOnlyToUtcDate(payload.date) },
      update: { note: payload.note },
      create: { date: dateOnlyToUtcDate(payload.date), note: payload.note },
    });

    return NextResponse.json({
      ok: true,
      data: {
        closureDate: {
          id: closureDate.id,
          date: formatDateOnly(closureDate.date),
          note: closureDate.note,
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid closure date.", error.issues);
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to save closure date.");
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const parsed = localDateSchema.safeParse(url.searchParams.get("date"));

  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Valid closure date is required.", parsed.error.issues);
  }

  await db.closureDate.deleteMany({
    where: { date: dateOnlyToUtcDate(parsed.data) },
  });

  return NextResponse.json({ ok: true });
}
