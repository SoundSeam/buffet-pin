import { Prisma, ReservationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import {
  ReservationRuleError,
  assertCapacityForParty,
  assertDateIsNotPast,
  assertDateIsOpen,
  assertReservationSlot,
  assertPartySize,
} from "@/lib/reservations/rules";
import { getReservationSettings } from "@/lib/reservations/settings";
import {
  dateOnlyToUtcDate,
  formatDateOnly,
  formatSlotTime,
  reservationAtFromLocalSlot,
  timeOnlyToUtcDate,
} from "@/lib/reservations/time";
import { getAdminUser } from "@/lib/supabase/auth";
import { localDateSchema, slotTimeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const updateReservationSchema = z.object({
  action: z.enum(["cancel", "complete", "no_show"]).optional(),
  date: localDateSchema.optional(),
  time: slotTimeSchema.optional(),
  partySize: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(7).max(40).optional(),
  email: z
    .union([z.string().trim().email().max(255), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null)),
  specialRequests: z
    .union([z.string().trim().max(1000), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null)),
  internalNotes: z
    .union([z.string().trim().max(2000), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null)),
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

async function lockReservationSlot(
  tx: Prisma.TransactionClient,
  date: string,
  time: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reservation:${date}:${time}`}))`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  let payload: z.infer<typeof updateReservationSchema>;

  try {
    payload = updateReservationSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid reservation update.", error.issues);
    }
    return errorResponse(400, "INVALID_JSON", "Invalid reservation update.");
  }

  try {
    const reservation = await db.$transaction(
      async (tx) => {
        const [settings, current] = await Promise.all([
          getReservationSettings(tx),
          tx.reservation.findUnique({
            where: { id },
            select: {
              id: true,
              reservationDate: true,
              reservationTime: true,
              reservationAt: true,
              partySize: true,
            },
          }),
        ]);

        if (!current) return null;

        const nextDate = payload.date ?? formatDateOnly(current.reservationDate);
        const nextTime = payload.time ?? formatSlotTime(current.reservationTime);
        const nextPartySize = payload.partySize ?? current.partySize;
        const dateTimeChanged =
          nextDate !== formatDateOnly(current.reservationDate) ||
          nextTime !== formatSlotTime(current.reservationTime) ||
          nextPartySize !== current.partySize;

        if (dateTimeChanged) {
          await lockReservationSlot(tx, nextDate, nextTime);
          assertReservationSlot(settings, nextTime);
          assertPartySize(settings, nextPartySize);
          assertDateIsNotPast(nextDate);
          await assertDateIsOpen(tx, nextDate);
          await assertCapacityForParty(tx, settings, {
            reservationDate: nextDate,
            reservationTime: nextTime,
            partySize: nextPartySize,
            excludeReservationId: id,
          });
        }

        const status =
          payload.action === "cancel"
            ? ReservationStatus.CANCELLED
            : payload.action === "complete"
              ? ReservationStatus.COMPLETED
              : payload.action === "no_show"
                ? ReservationStatus.NO_SHOW
                : undefined;

        return tx.reservation.update({
          where: { id },
          data: {
            ...(dateTimeChanged
              ? {
                  reservationDate: dateOnlyToUtcDate(nextDate),
                  reservationTime: timeOnlyToUtcDate(nextTime),
                  reservationAt: reservationAtFromLocalSlot(nextDate, nextTime),
                  partySize: nextPartySize,
                }
              : {}),
            ...(payload.name !== undefined ? { guestName: payload.name } : {}),
            ...(payload.phone !== undefined ? { guestPhone: payload.phone } : {}),
            ...(payload.email !== undefined ? { guestEmail: payload.email } : {}),
            ...(payload.specialRequests !== undefined
              ? { specialRequests: payload.specialRequests }
              : {}),
            ...(payload.internalNotes !== undefined
              ? { internalNotes: payload.internalNotes }
              : {}),
            ...(status ? { status } : {}),
            ...(payload.action === "cancel" ? { cancelledAt: new Date() } : {}),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!reservation) {
      return errorResponse(404, "RESERVATION_NOT_FOUND", "Reservation not found.");
    }

    return NextResponse.json({ ok: true, data: { reservation } });
  } catch (error) {
    if (error instanceof ReservationRuleError) {
      const status = error.code === "INSUFFICIENT_CAPACITY" ? 409 : 400;
      return errorResponse(status, error.code, error.message);
    }
    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to update reservation.");
  }
}
