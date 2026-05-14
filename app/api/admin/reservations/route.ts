import { Prisma, ReservationLanguage, ReservationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/lib/db";
import { generateConfirmationCode } from "@/lib/reservations/codes";
import {
  ReservationRuleError,
  assertPublicBookingRules,
} from "@/lib/reservations/rules";
import {
  dateOnlyToUtcDate,
  formatDateOnly,
  formatSlotTime,
  reservationAtFromLocalSlot,
  timeOnlyToUtcDate,
  todayInBusinessTimeZone,
} from "@/lib/reservations/time";
import { buildManagePath } from "@/lib/reservations/manage-link";
import { getReservationSettings } from "@/lib/reservations/settings";
import { generateManageToken } from "@/lib/reservations/tokens";
import {
  sendAdminNewReservationSms,
  sendReservationConfirmationSms,
} from "@/lib/sms";
import { getAdminUser } from "@/lib/supabase/auth";
import {
  localDateSchema,
  reservationLanguageSchema,
  slotTimeSchema,
} from "@/lib/validation";

export const dynamic = "force-dynamic";
const MAX_CREATE_ATTEMPTS = 3;

const createReservationSchema = z.object({
  date: localDateSchema,
  time: slotTimeSchema,
  partySize: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(40),
  email: z
    .union([z.string().trim().email().max(255), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  language: reservationLanguageSchema.default("FR"),
  specialRequests: z
    .union([z.string().trim().max(1000), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  internalNotes: z
    .union([z.string().trim().max(2000), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
});

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
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

async function requireAdminResponse() {
  const user = await getAdminUser();
  return user ? null : errorResponse(401, "UNAUTHORIZED", "Admin access required.");
}

function serializeReservation(row: {
  id: string;
  confirmationCode: string;
  manageToken: string;
  status: ReservationStatus;
  reservationDate: Date;
  reservationTime: Date;
  reservationAt: Date;
  partySize: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  language: ReservationLanguage;
  specialRequests: string | null;
  internalNotes: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    confirmationCode: row.confirmationCode,
    manageUrlPath: buildManagePath(row.manageToken),
    status: row.status,
    date: formatDateOnly(row.reservationDate),
    time: formatSlotTime(row.reservationTime),
    reservationAt: row.reservationAt.toISOString(),
    partySize: row.partySize,
    guest: {
      name: row.guestName,
      phone: row.guestPhone,
      email: row.guestEmail,
      language: row.language,
    },
    specialRequests: row.specialRequests,
    internalNotes: row.internalNotes,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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
  language: ReservationLanguage;
}) {
  const result = await sendReservationConfirmationSms(reservation);

  if (!result.ok) {
    console.error("Admin reservation confirmation SMS failed", {
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
    console.error("Admin reservation confirmation SMS sent but timestamp update failed", {
      reservationId: reservation.id,
      error,
    });
  }
}

async function sendAdminReservationAlert(reservation: {
  id: string;
  reservationAt: Date;
  partySize: number;
  guestName: string;
  guestPhone: string;
}) {
  const result = await sendAdminNewReservationSms(reservation);

  if (!result.ok) {
    console.error("Admin new reservation alert SMS failed", {
      reservationId: reservation.id,
      skipped: result.skipped ?? false,
      error: result.error,
    });
  }
}

export async function GET(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const status = url.searchParams.get("status");
  const includePast = url.searchParams.get("includePast") === "true";

  const where: Prisma.ReservationWhereInput = {};

  if (date) {
    const parsedDate = localDateSchema.safeParse(date);
    if (!parsedDate.success) {
      return errorResponse(400, "INVALID_DATE", "Invalid date filter.", parsedDate.error.issues);
    }

    where.reservationDate = dateOnlyToUtcDate(date);
  } else if (dateFrom || dateTo) {
    const parsedDateFrom = dateFrom ? localDateSchema.safeParse(dateFrom) : null;
    const parsedDateTo = dateTo ? localDateSchema.safeParse(dateTo) : null;

    if (parsedDateFrom && !parsedDateFrom.success) {
      return errorResponse(
        400,
        "INVALID_DATE_RANGE",
        "Invalid start date filter.",
        parsedDateFrom.error.issues,
      );
    }

    if (parsedDateTo && !parsedDateTo.success) {
      return errorResponse(
        400,
        "INVALID_DATE_RANGE",
        "Invalid end date filter.",
        parsedDateTo.error.issues,
      );
    }

    where.reservationDate = {
      ...(dateFrom ? { gte: dateOnlyToUtcDate(dateFrom) } : {}),
      ...(dateTo ? { lte: dateOnlyToUtcDate(dateTo) } : {}),
    };
  } else if (!includePast) {
    where.reservationDate = {
      gte: dateOnlyToUtcDate(todayInBusinessTimeZone()),
    };
  }

  if (status && status !== "ALL") {
    if (!Object.values(ReservationStatus).includes(status as ReservationStatus)) {
      return errorResponse(400, "INVALID_STATUS", "Invalid status filter.");
    }

    where.status = status as ReservationStatus;
  }

  const reservations = await db.reservation.findMany({
    where,
    orderBy: [{ reservationDate: "asc" }, { reservationTime: "asc" }],
    select: {
      id: true,
      confirmationCode: true,
      manageToken: true,
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
      internalNotes: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      reservations: reservations.map(serializeReservation),
    },
  });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse();
  if (unauthorized) return unauthorized;

  let payload: z.infer<typeof createReservationSchema>;

  try {
    payload = createReservationSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid reservation.", error.issues);
    }
    return errorResponse(400, "INVALID_JSON", "Invalid reservation.");
  }

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      const reservation = await db.$transaction(
        async (tx) => {
          const settings = await getReservationSettings(tx);

          await lockReservationSlot(tx, payload.date, payload.time);

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
              reservationAt: reservationAtFromLocalSlot(payload.date, payload.time),
              partySize: payload.partySize,
              guestName: payload.name,
              guestPhone: payload.phone,
              guestEmail: payload.email,
              language: payload.language,
              specialRequests: payload.specialRequests,
              internalNotes: payload.internalNotes,
            },
            select: {
              id: true,
              confirmationCode: true,
              manageToken: true,
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
              internalNotes: true,
              cancelledAt: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await Promise.all([
        sendConfirmationSmsAndMarkSent(reservation),
        sendAdminReservationAlert(reservation),
      ]);

      return NextResponse.json(
        { ok: true, data: { reservation: serializeReservation(reservation) } },
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
