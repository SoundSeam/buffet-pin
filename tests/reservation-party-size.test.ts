import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { assertStaffBookingRules, assertPublicBookingRules, assertPublicPartySize, assertPublicUpdateRules } from "@/lib/reservations/rules";
import { reservationAtFromLocalSlot } from "@/lib/reservations/time";

const settings = { minPartySize: 6, maxPartySize: 15, slotCapacityGuests: 24, firstSlot: new Date("1970-01-01T16:30:00Z"), lastSlot: new Date("1970-01-01T20:00:00Z"), slotIntervalMinutes: 30, guestModifyCutoffHours: 24 };
const now = new Date("2026-09-15T12:00:00Z");
const query = { reservationDate: "2026-10-10", reservationTime: "17:00", partySize: 12, now };
function fakeDb(reserved = 0) {
  return { closureDate: { findUnique: vi.fn().mockResolvedValue(null) }, reservation: { aggregate: vi.fn().mockResolvedValue({ _sum: { partySize: reserved } }) } } as unknown as PrismaClient;
}
const update = { ...query, reservationId: "existing", currentReservationAt: reservationAtFromLocalSlot(query.reservationDate, query.reservationTime), currentPartySize: 6 };

describe("public online party-size policy", () => {
  it.each([6, 7, 8, 9, 10, 11, 12])("allows %i independently of legacy staff bounds", async (partySize) => {
    await expect(assertPublicBookingRules(fakeDb(), { ...settings, minPartySize: 1, maxPartySize: 5 }, { ...query, partySize })).resolves.toBeUndefined();
  });
  it.each([0, -1, 1, 5, 6.5, 13, 15, 100, NaN, Infinity])("rejects %s with phone guidance", (partySize) => {
    expect(() => assertPublicPartySize(partySize)).toThrow("(450) 699-8088");
  });
  it("still enforces slot capacity", async () => {
    await expect(assertPublicBookingRules(fakeDb(13), settings, query)).rejects.toMatchObject({ code: "INSUFFICIENT_CAPACITY" });
  });
  it("retains staff support for small and larger phone bookings", async () => {
    for (const partySize of [1, 5, 15]) {
      await expect(assertStaffBookingRules(fakeDb(), settings, { ...query, partySize })).resolves.toBeUndefined();
    }
    await expect(assertStaffBookingRules(fakeDb(), settings, { ...query, partySize: 16 })).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it.each([5, 13])("rejects guest changes outside the range: %i", async (partySize) => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, partySize })).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it.each([4, 15])("preserves contact edits for an unchanged historical party of %i", async (partySize) => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize: partySize, partySize })).resolves.toBeUndefined();
  });
  it.each([4, 15])("permits an existing party of %i to change into the online range", async (currentPartySize) => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize })).resolves.toBeUndefined();
  });
  it.each([[4, 5], [15, 14]])("requires calling to change from %i to %i", async (currentPartySize, partySize) => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize, partySize })).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it.each([4, 15])("requires calling to reschedule an outside-range party of %i", async (partySize) => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize: partySize, partySize, reservationTime: "18:00", nextReservationAt: reservationAtFromLocalSlot(query.reservationDate, "18:00") })).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it("preserves the cutoff for existing bookings", async () => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize: 4, partySize: 4, now: update.currentReservationAt })).rejects.toMatchObject({ code: "MODIFY_CUTOFF_PASSED" });
  });
});
