import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { assertStaffBookingRules, assertPublicBookingRules, assertPublicPartySize, assertPublicUpdateRules } from "@/lib/reservations/rules";
import { reservationAtFromLocalSlot } from "@/lib/reservations/time";

const settings = { minPartySize: 6, maxPartySize: 15, slotCapacityGuests: 24, firstSlot: new Date("1970-01-01T16:30:00Z"), lastSlot: new Date("1970-01-01T20:00:00Z"), slotIntervalMinutes: 30, guestModifyCutoffHours: 24 };
const now = new Date("2026-09-10T12:00:00Z");
const query = { reservationDate: "2026-10-10", reservationTime: "17:00", partySize: 5, now };
function fakeDb(reserved = 0) {
  return { closureDate: { findUnique: vi.fn().mockResolvedValue(null) }, reservation: { aggregate: vi.fn().mockResolvedValue({ _sum: { partySize: reserved } }) } } as unknown as PrismaClient;
}
const update = { ...query, reservationId: "existing", currentReservationAt: reservationAtFromLocalSlot(query.reservationDate, query.reservationTime), currentPartySize: 5 };

describe("public online party-size policy", () => {
  it.each([1, 2, 3, 4, 5])("allows %i independently of legacy staff bounds", async (partySize) => {
    await expect(assertPublicBookingRules(fakeDb(), settings, { ...query, partySize })).resolves.toBeUndefined();
  });
  it.each([0, -1, 1.5, 6, 15, 100, NaN, Infinity])("rejects %s with phone guidance", (partySize) => {
    expect(() => assertPublicPartySize(partySize)).toThrow("(450) 699-8088");
  });
  it("still enforces slot capacity", async () => {
    await expect(assertPublicBookingRules(fakeDb(20), settings, query)).rejects.toMatchObject({ code: "INSUFFICIENT_CAPACITY" });
  });
  it("retains the configured staff booking range", async () => {
    await expect(assertStaffBookingRules(fakeDb(), settings, { ...query, partySize: 15 })).resolves.toBeUndefined();
    await expect(assertStaffBookingRules(fakeDb(), settings, { ...query, partySize: 16 })).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it("rejects guest increases beyond five", async () => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, partySize: 6 })).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it("preserves contact edits for an unchanged larger booking", async () => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize: 10, partySize: 10 })).resolves.toBeUndefined();
  });
  it("permits a larger party to reduce to five", async () => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize: 10 })).resolves.toBeUndefined();
  });
  it("requires calling for a different larger party size", async () => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize: 10, partySize: 9 })).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it("requires calling to reschedule a larger booking", async () => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize: 10, partySize: 10, reservationTime: "18:00", nextReservationAt: reservationAtFromLocalSlot(query.reservationDate, "18:00") })).rejects.toMatchObject({ code: "INVALID_PARTY_SIZE" });
  });
  it("preserves the cutoff for existing larger bookings", async () => {
    await expect(assertPublicUpdateRules(fakeDb(), settings, { ...update, currentPartySize: 10, partySize: 10, now: update.currentReservationAt })).rejects.toMatchObject({ code: "MODIFY_CUTOFF_PASSED" });
  });
});
