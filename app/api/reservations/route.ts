import { Prisma, ReservationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  PUBLIC_ENDPOINT_RATE_LIMITS,
  consumeRateLimit,
  getPublicClientRateLimitKey,
  getReservationPhoneRateLimitKey,
} from "@/lib/abuse-protection";
import { db } from "@/lib/db";
import { generateConfirmationCode } from "@/lib/reservations/codes";
import {
  ReservationRuleError,
  assertPublicBookingRules,
} from "@/lib/reservations/rules";
import {
  dateOnlyToUtcDate,
  reservationAtFromLocalSlot,
  timeOnlyToUtcDate,
} from "@/lib/reservations/time";
import { generateManageToken } from "@/lib/reservations/tokens";
import { getReservationSettings } from "@/lib/reservations/settings";
import {
  type PublicReservationCreatePayload,
  publicReservationCreatePayloadSchema,
} from "@/lib/validation";
import { buildManagePath } from "@/lib/reservations/manage-link";
import { sendReservationConfirmationSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

const MAX_CREATE_ATTEMPTS = 3;

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
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
    { status, headers },
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
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

async function sendConfirmationSmsAndMarkSent(reservation: {
  id: string;
  confirmationCode: string;
  manageToken: string;
  reservationAt: Date;
  partySize: number;
  guestPhone: string;
  language: PublicReservationCreatePayload["language"];
}) {
  const result = await sendReservationConfirmationSms(reservation);

  if (!result.ok) {
    console.error("Reservation confirmation SMS failed", {
      reservationId: reservation.id,
      skipped: result.skipped ?? false,
      error: result.error,
    });
    return;
  }

  try {
    await db.reservation.update({
      where: { id: reservation.id },
      data: { confirmationSentAt: new Date() },
    });
  } catch (error) {
    console.error("Reservation confirmation SMS sent but timestamp update failed", {
      reservationId: reservation.id,
      error,
    });
  }
}

export async function POST(request: Request) {
  const clientRateLimit = await consumeRateLimit(
    db,
    PUBLIC_ENDPOINT_RATE_LIMITS.reservationCreateClient,
    getPublicClientRateLimitKey(request),
  );

  if (!clientRateLimit.ok) {
    return errorResponse(
      429,
      "RATE_LIMITED",
      "Too many reservation requests. Please try again later.",
      { retryAfterSeconds: clientRateLimit.retryAfterSeconds },
      { "Retry-After": clientRateLimit.retryAfterSeconds.toString() },
    );
  }

  let payload: PublicReservationCreatePayload;

  try {
    payload = publicReservationCreatePayloadSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid reservation request.",
        error.issues,
      );
    }

    return errorResponse(400, "INVALID_JSON", "Invalid reservation request.");
  }

  const phoneRateLimit = await consumeRateLimit(
    db,
    PUBLIC_ENDPOINT_RATE_LIMITS.reservationCreatePhone,
    getReservationPhoneRateLimitKey(payload.phone),
  );

  if (!phoneRateLimit.ok) {
    return errorResponse(
      429,
      "RATE_LIMITED",
      "Too many reservation requests. Please try again later.",
      { retryAfterSeconds: phoneRateLimit.retryAfterSeconds },
      { "Retry-After": phoneRateLimit.retryAfterSeconds.toString() },
    );
  }

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      const reservation = await db.$transaction(
        async (tx) => {
          const settings = await getReservationSettings(tx);

          await lockReservationSlot(tx, payload.date, payload.time);

          const reservationAt = reservationAtFromLocalSlot(
            payload.date,
            payload.time,
          );

          await assertPublicBookingRules(tx, settings, {
            reservationDate: payload.date,
            reservationTime: payload.time,
            partySize: payload.partySize,
          });

          return tx.reservation.create({
            data: {
              confirmationCode: generateConfirmationCode(),
              manageToken: generateManageToken(),
              status: ReservationStatus.CONFIRMED,
              reservationDate: dateOnlyToUtcDate(payload.date),
              reservationTime: timeOnlyToUtcDate(payload.time),
              reservationAt,
              partySize: payload.partySize,
              guestName: payload.name,
              guestPhone: payload.phone,
              guestEmail: payload.email,
              language: payload.language,
              specialRequests: payload.specialRequests,
            },
            select: {
              id: true,
              confirmationCode: true,
              manageToken: true,
              status: true,
              reservationAt: true,
              partySize: true,
              guestName: true,
              guestPhone: true,
              guestEmail: true,
              language: true,
              specialRequests: true,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      await sendConfirmationSmsAndMarkSent(reservation);

      return NextResponse.json(
        {
          ok: true,
          data: {
            reservation: {
              id: reservation.id,
              confirmationCode: reservation.confirmationCode,
              status: reservation.status,
              date: payload.date,
              time: payload.time,
              reservationAt: reservation.reservationAt.toISOString(),
              partySize: reservation.partySize,
              guest: {
                name: reservation.guestName,
                phone: reservation.guestPhone,
                email: reservation.guestEmail,
                language: reservation.language,
              },
              specialRequests: reservation.specialRequests,
            },
            manageUrlPath: buildManagePath(reservation.manageToken),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof ReservationRuleError) {
        const status = error.code === "INSUFFICIENT_CAPACITY" ? 409 : 400;
        return errorResponse(status, error.code, error.message);
      }

      if (isUniqueConstraintError(error) && attempt < MAX_CREATE_ATTEMPTS) {
        continue;
      }

      if (isRetryableTransactionError(error) && attempt < MAX_CREATE_ATTEMPTS) {
        continue;
      }

      if (isUniqueConstraintError(error)) {
        return errorResponse(
          409,
          "RESERVATION_CODE_COLLISION",
          "Unable to create a unique reservation.",
        );
      }

      if (isRetryableTransactionError(error)) {
        return errorResponse(
          409,
          "RESERVATION_CONFLICT",
          "Reservation capacity changed while creating this booking.",
        );
      }

      console.error(error);
      return errorResponse(500, "INTERNAL_ERROR", "Unable to create reservation.");
    }
  }

  return errorResponse(500, "INTERNAL_ERROR", "Unable to create reservation.");
}
