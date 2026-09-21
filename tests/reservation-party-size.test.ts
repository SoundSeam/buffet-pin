import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { assertPartySize, assertPublicBookingRules, assertPublicUpdateRules } from "@/lib/reservations/rules";
import { publicReservationCreatePayloadSchema } from "@/lib/validation";
import { reservationAtFromLocalSlot } from "@/lib/reservations/time";
const settings = { minPartySize: 6, maxPartySize: 12, slotCapacityGuests: 24, firstSlot: new Date("1970-01-01T16:30:00Z"), lastSlot: new Date("1970-01-01T20:00:00Z"), slotIntervalMinutes: 30, guestModifyCutoffHours: 24 };
const query = { reservationDate: "2026-10-10", reservationTime: "17:00", partySize: 12, now: new Date("2026-09-20T12:00:00Z") };
function fakeDb(reserved = 0) {
  return { closureDate: { findUnique: vi.fn().mockResolvedValue(null) }, reservation: { aggregate: vi.fn().mockResolvedValue({ _sum: { partySize: reserved } }) } } as unknown as PrismaClient;
}
const update = { ...query, reservationId: "existing", currentReservationAt: reservationAtFromLocalSlot(query.reservationDate, query.reservationTime) };
describe("July shared reservation policy with maximum twelve", () => {
  it.each([6, 7, 8, 9, 10, 11, 12])("allows configured party size %i", async (partySize) => {
    await expect(assertPublicBookingRules(fakeDb(), settings, { ...query, partySize })).resolves.toBeUndefined();
  });
  it.each([0, -1, 1, 5, 13, 15, 100])("rejects %i with the original settings-based error", (partySize) => {
    expect(() => assertPartySize(settings, partySize)).toThrow("Party size must be between 6 and 12.");
  });
  it.each([6.5, NaN, Infinity])("rejects malformed %s at the API validation boundary", (partySize) => {
    expect(publicReservationCreatePayloadSchema.safeParse({ date: query.reservationDate, time: "17:00", partySize, name: "Test Guest", phone: "+15145550199", language: "EN" }).success).toBe(false);
  });
  it("uses configured bounds rather than bypassing them with separate public/staff policies", async () => {
    const custom = { ...settings, minPartySize: 2, maxPartySize: 4 };
    await expect(assertPublicBookingRules(fakeDb(), custom, { ...query, partySize: 4 })).resolves.toBeUndefined();
    await expect(assertPublicBookingRules(fakeDb(), custom, query)).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it("still enforces slot capacity", async () => {
    await expect(assertPublicBookingRules(fakeDb(13), settings, query)).rejects.toMatchObject({ code: "INSUFFICIENT_CAPACITY" });
  });
  it.each([4, 5, 13, 15])("rejects guest updates outside configured bounds: %i", async (partySize) => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, partySize })).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it("allows valid guest rescheduling", async () => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, reservationTime: "18:00", nextReservationAt: reservationAtFromLocalSlot(query.reservationDate, "18:00") })).resolves.toBeUndefined();
  });
  it("preserves the modification cutoff", async () => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, now: update.currentReservationAt })).rejects.toMatchObject({ code: "MODIFY_CUTOFF_PASSED" });
  });
});
