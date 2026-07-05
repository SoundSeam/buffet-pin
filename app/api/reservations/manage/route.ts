import { Prisma, ReservationStatus, type Reservation } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import {
  ReservationRuleError,
  assertBeforeGuestModifyCutoff,
  assertPublicUpdateRules,
  getGuestModifyCutoff,
} from "@/lib/reservations/rules";
import { getReservationSettings } from "@/lib/reservations/settings";
import {
  dateOnlyToUtcDate,
  formatDateOnly,
  formatSlotTime,
  reservationAtFromLocalSlot,
  timeOnlyToUtcDate,
} from "@/lib/reservations/time";
import {
  sendAdminReservationCancelledSms,
  sendAdminReservationUpdatedSms,
} from "@/lib/sms";
import {
  type ManageReservationUpdatePayload,
  manageReservationLookupSchema,
  manageReservationUpdatePayloadSchema,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_UPDATE_ATTEMPTS = 3;

type ManageReservation = Pick<
  Reservation,
  | "id"
  | "confirmationCode"
  | "status"
  | "reservationDate"
  | "reservationTime"
  | "reservationAt"
  | "partySize"
  | "guestName"
  | "guestPhone"
  | "guestEmail"
  | "language"
  | "specialRequests"
  | "cancelledAt"
>;

type ReservationNotificationSnapshot = Pick<
  Reservation,
  | "id"
  | "reservationAt"
  | "partySize"
  | "guestName"
  | "guestPhone"
  | "guestEmail"
  | "specialRequests"
>;

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function lockReservationSlot(
  tx: Prisma.TransactionClient,
  date: string,
  time: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reservation:${date}:${time}`}))`;
}

function serializeReservation(
  reservation: ManageReservation,
  cutoffAt: Date,
  editingAllowed: boolean,
) {
  return {
    id: reservation.id,
    confirmationCode: reservation.confirmationCode,
    status: reservation.status,
    date: formatDateOnly(reservation.reservationDate),
    time: formatSlotTime(reservation.reservationTime),
    reservationAt: reservation.reservationAt.toISOString(),
    cutoffAt: cutoffAt.toISOString(),
    editingAllowed,
    partySize: reservation.partySize,
    guest: {
      name: reservation.guestName,
      phone: reservation.guestPhone,
      email: reservation.guestEmail,
      language: reservation.language,
    },
    specialRequests: reservation.specialRequests,
    cancelledAt: reservation.cancelledAt?.toISOString() ?? null,
  };
}

async function getReservationByToken(token: string) {
  return db.reservation.findUnique({
    where: { manageToken: token },
    select: {
      id: true,
      confirmationCode: true,
      status: true,
      reservationDate: true,
      reservationTime: true,
      reservationAt: true,
      partySize: true,
      guestName: true,
      guestPhone: true,
      guestEmail: true,
      language: true,
      specialRequests: true,
      cancelledAt: true,
    },
  });
}

async function sendAdminReservationUpdateAlert(
  previousReservation: ReservationNotificationSnapshot,
  updatedReservation: ReservationNotificationSnapshot,
) {
  const changed =
    previousReservation.reservationAt.getTime() !==
      updatedReservation.reservationAt.getTime() ||
    previousReservation.partySize !== updatedReservation.partySize ||
    previousReservation.guestName !== updatedReservation.guestName ||
    previousReservation.guestPhone !== updatedReservation.guestPhone ||
    previousReservation.guestEmail !== updatedReservation.guestEmail ||
    previousReservation.specialRequests !== updatedReservation.specialRequests;

  if (!changed) {
    return;
  }

  const result = await sendAdminReservationUpdatedSms({
    previousReservationAt: previousReservation.reservationAt,
    previousPartySize: previousReservation.partySize,
    previousGuestName: previousReservation.guestName,
    previousGuestPhone: previousReservation.guestPhone,
    previousGuestEmail: previousReservation.guestEmail,
    previousSpecialRequests: previousReservation.specialRequests,
    reservationAt: updatedReservation.reservationAt,
    partySize: updatedReservation.partySize,
    guestName: updatedReservation.guestName,
    guestPhone: updatedReservation.guestPhone,
    guestEmail: updatedReservation.guestEmail,
    specialRequests: updatedReservation.specialRequests,
  });

  if (!result.ok) {
    console.error("Admin reservation update alert SMS failed", {
      reservationId: updatedReservation.id,
      skipped: result.skipped ?? false,
      error: result.error,
    });
  }
}

async function sendAdminReservationCancellationAlert(
  reservation: ReservationNotificationSnapshot,
) {
  const result = await sendAdminReservationCancelledSms(reservation);

  if (!result.ok) {
    console.error("Admin reservation cancellation alert SMS failed", {
      reservationId: reservation.id,
      skipped: result.skipped ?? false,
      error: result.error,
    });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = manageReservationLookupSchema.safeParse({
    token: url.searchParams.get("token"),
  });

  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_TOKEN",
      "A valid manage token is required.",
      parsed.error.issues,
    );
  }

  const [settings, reservation] = await Promise.all([
    getReservationSettings(db, { includeSlotCapacities: false }),
    getReservationByToken(parsed.data.token),
  ]);

  if (!reservation) {
    return errorResponse(404, "RESERVATION_NOT_FOUND", "Reservation not found.");
  }

  const cutoffAt = getGuestModifyCutoff(settings, reservation.reservationAt);
  const editingAllowed =
    reservation.status !== ReservationStatus.CANCELLED &&
    new Date().getTime() <= cutoffAt.getTime();

  return NextResponse.json({
    ok: true,
    data: {
      reservation: serializeReservation(reservation, cutoffAt, editingAllowed),
    },
  });
}

export async function PATCH(request: Request) {
  let payload: ManageReservationUpdatePayload;

  try {
    payload = manageReservationUpdatePayloadSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid manage update request.",
        error.issues,
      );
    }

    return errorResponse(400, "INVALID_JSON", "Invalid manage update request.");
  }

  for (let attempt = 1; attempt <= MAX_UPDATE_ATTEMPTS; attempt += 1) {
    try {
      const updateResult = await db.$transaction(
        async (tx) => {
          const settings = await getReservationSettings(tx);
          const now = new Date();

          const reservation = await tx.reservation.findUnique({
            where: { manageToken: payload.token },
            select: {
              id: true,
              status: true,
              reservationDate: true,
              reservationTime: true,
              reservationAt: true,
              partySize: true,
              guestName: true,
              guestPhone: true,
              guestEmail: true,
              specialRequests: true,
            },
          });

          if (!reservation) {
            return null;
          }

          if (reservation.status === ReservationStatus.CANCELLED) {
            throw new ReservationRuleError(
              "MODIFY_CUTOFF_PASSED",
              "Cancelled reservations cannot be modified.",
            );
          }

          const nextDate = payload.date ?? formatDateOnly(reservation.reservationDate);
          const nextTime = payload.time ?? formatSlotTime(reservation.reservationTime);
          const nextPartySize = payload.partySize ?? reservation.partySize;
          const nextReservationAt = reservationAtFromLocalSlot(nextDate, nextTime);

          await lockReservationSlot(tx, nextDate, nextTime);

          await assertPublicUpdateRules(tx, settings, {
            reservationId: reservation.id,
            reservationDate: nextDate,
            reservationTime: nextTime,
            currentReservationAt: reservation.reservationAt,
            nextReservationAt,
            partySize: nextPartySize,
            now,
          });

          const updatedReservation = await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              reservationDate: dateOnlyToUtcDate(nextDate),
              reservationTime: timeOnlyToUtcDate(nextTime),
              reservationAt: nextReservationAt,
              partySize: nextPartySize,
              ...(payload.name !== undefined ? { guestName: payload.name } : {}),
              ...(payload.phone !== undefined ? { guestPhone: payload.phone } : {}),
              ...(payload.email !== undefined ? { guestEmail: payload.email } : {}),
              ...(payload.specialRequests !== undefined
                ? { specialRequests: payload.specialRequests }
                : {}),
            },
            select: {
              id: true,
              confirmationCode: true,
              status: true,
              reservationDate: true,
              reservationTime: true,
              reservationAt: true,
              partySize: true,
              guestName: true,
              guestPhone: true,
              guestEmail: true,
              language: true,
              specialRequests: true,
              cancelledAt: true,
            },
          });

          return {
            previousReservation: reservation,
            updatedReservation,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (!updateResult) {
        return errorResponse(404, "RESERVATION_NOT_FOUND", "Reservation not found.");
      }

      const { previousReservation, updatedReservation } = updateResult;

      await sendAdminReservationUpdateAlert(
        previousReservation,
        updatedReservation,
      );

      const settings = await getReservationSettings(db, { includeSlotCapacities: false });

      const cutoffAt = getGuestModifyCutoff(settings, updatedReservation.reservationAt);

      return NextResponse.json({
        ok: true,
        data: {
          reservation: serializeReservation(updatedReservation, cutoffAt, true),
        },
      });
    } catch (error) {
      if (error instanceof ReservationRuleError) {
        const status = error.code === "INSUFFICIENT_CAPACITY" ? 409 : 400;
        return errorResponse(status, error.code, error.message);
      }

      if (isRetryableTransactionError(error) && attempt < MAX_UPDATE_ATTEMPTS) {
        continue;
      }

      if (isRetryableTransactionError(error)) {
        return errorResponse(
          409,
          "RESERVATION_CONFLICT",
          "Reservation capacity changed while updating this booking.",
        );
      }

      console.error(error);
      return errorResponse(500, "INTERNAL_ERROR", "Unable to update reservation.");
    }
  }

  return errorResponse(500, "INTERNAL_ERROR", "Unable to update reservation.");
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const parsed = manageReservationLookupSchema.safeParse({
    token: url.searchParams.get("token"),
  });

  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_TOKEN",
      "A valid manage token is required.",
      parsed.error.issues,
    );
  }

  try {
    const cancelledReservation = await db.$transaction(async (tx) => {
      const settings = await getReservationSettings(tx, { includeSlotCapacities: false });

      const reservation = await tx.reservation.findUnique({
        where: { manageToken: parsed.data.token },
        select: {
          id: true,
          status: true,
          reservationAt: true,
        },
      });

      if (!reservation) {
        return null;
      }

      if (reservation.status === ReservationStatus.CANCELLED) {
        throw new ReservationRuleError(
          "MODIFY_CUTOFF_PASSED",
          "Reservation is already cancelled.",
        );
      }

      assertBeforeGuestModifyCutoff(settings, reservation.reservationAt);

      return tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        select: {
          id: true,
          confirmationCode: true,
          status: true,
          reservationDate: true,
          reservationTime: true,
          reservationAt: true,
          partySize: true,
          guestName: true,
          guestPhone: true,
          guestEmail: true,
          language: true,
          specialRequests: true,
          cancelledAt: true,
        },
      });
    });

    if (!cancelledReservation) {
      return errorResponse(404, "RESERVATION_NOT_FOUND", "Reservation not found.");
    }

    await sendAdminReservationCancellationAlert(cancelledReservation);

    const settings = await getReservationSettings(db, { includeSlotCapacities: false });

    const cutoffAt = getGuestModifyCutoff(settings, cancelledReservation.reservationAt);

    return NextResponse.json({
      ok: true,
      data: {
        reservation: serializeReservation(cancelledReservation, cutoffAt, false),
      },
    });
  } catch (error) {
    if (error instanceof ReservationRuleError) {
      return errorResponse(400, error.code, error.message);
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to cancel reservation.");
  }
}
