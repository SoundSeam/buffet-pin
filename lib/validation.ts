import { z } from "zod";

import {
  DATE_PATTERN,
  TIME_PATTERN,
  parseLocalDate,
  parseSlotTime,
} from "./reservations/time";
import { MANAGE_TOKEN_LENGTH } from "./reservations/tokens";

const optionalText = (maxLength: number) =>
  z
    .union([z.string().trim().max(maxLength), z.literal(""), z.null()])
    .transform((value) => (value ? value : undefined))
    .optional();

const nullableText = (maxLength: number) =>
  z
    .union([z.string().trim().max(maxLength), z.literal(""), z.null()])
    .transform((value) => (value === "" ? null : value))
    .optional();

const nullableEmail = z
  .union([z.string().trim().email().max(255), z.literal(""), z.null()])
  .transform((value) => (value === "" ? null : value))
  .optional();

const optionalEmail = z
  .union([z.string().trim().email().max(255), z.literal(""), z.null()])
  .transform((value) => (value ? value : undefined))
  .optional();

const TIME_WITH_ZERO_SECONDS_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:00$/;

const normalizeSlotTimeValue = (value: unknown) => {
  if (typeof value === "string" && TIME_WITH_ZERO_SECONDS_PATTERN.test(value)) {
    return value.slice(0, 5);
  }

  return value;
};

export const localDateSchema = z
  .string()
  .regex(DATE_PATTERN, "Expected date in YYYY-MM-DD format")
  .refine(
    (value) => {
      try {
        parseLocalDate(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Expected a valid calendar date" },
  );

export const slotTimeSchema = z.preprocess(
  normalizeSlotTimeValue,
  z
    .string()
    .regex(TIME_PATTERN, "Expected time in HH:mm format")
    .refine(
      (value) => {
        try {
          parseSlotTime(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Expected a valid slot time" },
    ),
);

export const reservationLanguageSchema = z.enum(["EN", "FR"]);

export const publicBookingPayloadSchema = z.object({
  reservationDate: localDateSchema,
  reservationTime: slotTimeSchema,
  partySize: z.coerce.number().int().positive(),
  guestName: z.string().trim().min(1).max(120),
  guestPhone: z.string().trim().min(7).max(40),
  guestEmail: optionalEmail,
  language: reservationLanguageSchema.default("FR"),
  specialRequests: optionalText(1000),
});

export const publicAvailabilityPayloadSchema = z.object({
  date: localDateSchema,
  partySize: z.coerce.number().int().positive(),
});

export const publicReservationCreatePayloadSchema = z.object({
  date: localDateSchema,
  time: slotTimeSchema,
  partySize: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(40),
  email: optionalEmail,
  language: reservationLanguageSchema.default("FR"),
  specialRequests: optionalText(1000),
});

export const manageTokenSchema = z.string().trim().min(MANAGE_TOKEN_LENGTH).max(256);

export const manageReservationLookupSchema = z.object({
  token: manageTokenSchema,
});

export const manageReservationUpdatePayloadSchema = z.object({
  token: manageTokenSchema,
  date: localDateSchema.optional(),
  time: slotTimeSchema.optional(),
  partySize: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(7).max(40).optional(),
  email: nullableEmail,
  specialRequests: nullableText(1000),
});

export const manageReservationCancelPayloadSchema = z.object({
  token: manageTokenSchema,
});

export type PublicBookingPayload = z.infer<typeof publicBookingPayloadSchema>;
export type PublicAvailabilityPayload = z.infer<
  typeof publicAvailabilityPayloadSchema
>;
export type PublicReservationCreatePayload = z.infer<
  typeof publicReservationCreatePayloadSchema
>;
export type ManageReservationLookup = z.infer<
  typeof manageReservationLookupSchema
>;
export type ManageReservationUpdatePayload = z.infer<
  typeof manageReservationUpdatePayloadSchema
>;
export type ManageReservationCancelPayload = z.infer<
  typeof manageReservationCancelPayloadSchema
>;
