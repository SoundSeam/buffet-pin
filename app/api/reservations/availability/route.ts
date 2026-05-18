import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  PUBLIC_ENDPOINT_RATE_LIMITS,
  consumeRateLimit,
  getPublicClientRateLimitKey,
} from "@/lib/abuse-protection";
import { db } from "@/lib/db";
import { getCapacityBySlot } from "@/lib/reservations/capacity";
import { getReservationSettings } from "@/lib/reservations/settings";
import {
  ReservationRuleError,
  assertDateIsNotPast,
  assertDateIsOpen,
  assertPartySize,
} from "@/lib/reservations/rules";
import { generateReservationSlotsFromSettings } from "@/lib/reservations/slots";
import { isLocalSlotAtLeastLeadTimeAway } from "@/lib/reservations/time";
import {
  type PublicAvailabilityPayload,
  publicAvailabilityPayloadSchema,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const clientRateLimit = await consumeRateLimit(
    db,
    PUBLIC_ENDPOINT_RATE_LIMITS.availabilityClient,
    getPublicClientRateLimitKey(request),
  );

  if (!clientRateLimit.ok) {
    return errorResponse(
      429,
      "RATE_LIMITED",
      "Too many availability requests. Please try again later.",
      { retryAfterSeconds: clientRateLimit.retryAfterSeconds },
      { "Retry-After": clientRateLimit.retryAfterSeconds.toString() },
    );
  }

  let payload: PublicAvailabilityPayload;

  try {
    payload = publicAvailabilityPayloadSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid availability request.",
        error.issues,
      );
    }

    return errorResponse(400, "INVALID_JSON", "Invalid availability request.");
  }

  try {
    const settings = await getReservationSettings(db);
    const now = new Date();

    assertPartySize(settings, payload.partySize);
    assertDateIsNotPast(payload.date, now);
    await assertDateIsOpen(db, payload.date);

    const reservationTimes = generateReservationSlotsFromSettings(settings);
    const slots = await getCapacityBySlot(db, settings, {
      reservationDate: payload.date,
      reservationTimes,
    });

    return NextResponse.json({
      ok: true,
      data: {
        date: payload.date,
        partySize: payload.partySize,
        slots: slots
          .filter((slot) => slot.remainingCapacity >= payload.partySize)
          .filter((slot) =>
            isLocalSlotAtLeastLeadTimeAway(payload.date, slot.reservationTime, now),
          )
          .map((slot) => ({
            time: slot.reservationTime,
            remainingCapacity: slot.remainingCapacity,
          })),
      },
    });
  } catch (error) {
    if (error instanceof ReservationRuleError) {
      return errorResponse(400, error.code, error.message);
    }

    console.error(error);
    return errorResponse(500, "INTERNAL_ERROR", "Unable to load availability.");
  }
}
