import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
import { assertOnlineReservationsEnabled, setOnlineReservationsEnabled } from "@/lib/reservations/availability";

// Intentionally hard-coded to the disposable local database, never caller credentials.
const db = new PrismaClient({ datasourceUrl: "postgresql://reservation_test@127.0.0.1:55439/reservation_switch_test" });
beforeAll(() => db.settings.update({ where: { id: 1 }, data: { onlineReservationsEnabled: false } }));
afterAll(() => db.$disconnect());

describe("availability transaction and audit", () => {
  it("preserves the pre-migration reservation sentinel and defaults closed", async () => {
    const reservation = await db.reservation.findUniqueOrThrow({ where: { id: "availability-sentinel" } });
    expect(reservation.guestName).toBe("Preserved Test Guest");
    expect(reservation.partySize).toBe(6);
    expect((await db.settings.findUniqueOrThrow({ where: { id: 1 } })).onlineReservationsEnabled).toBe(false);
    await expect(db.$transaction((tx) => assertOnlineReservationsEnabled(tx))).rejects.toMatchObject({ code: "RESERVATIONS_DISABLED" });
  });
  it("persists administrator identity and deduplicates concurrent repeated saves", async () => {
    const before = await db.reservationAvailabilityEvent.count();
    await Promise.all([1, 2].map(() => db.$transaction((tx) => setOnlineReservationsEnabled(tx, true, "test-admin"))));
    expect(await db.reservationAvailabilityEvent.count()).toBe(before + 1);
    const event = await db.reservationAvailabilityEvent.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(event).toMatchObject({ previousEnabled: false, enabled: true, actorId: "test-admin" });
    expect(event.createdAt).toBeInstanceOf(Date);
    await db.$transaction((tx) => assertOnlineReservationsEnabled(tx));
  });
  it("rolls back availability and audit together on transaction failure", async () => {
    const before = await db.reservationAvailabilityEvent.count();
    await expect(db.$transaction(async (tx) => {
      await setOnlineReservationsEnabled(tx, false, "test-admin");
      throw new Error("abort save");
    })).rejects.toThrow("abort save");
    expect((await db.settings.findUniqueOrThrow({ where: { id: 1 } })).onlineReservationsEnabled).toBe(true);
    expect(await db.reservationAvailabilityEvent.count()).toBe(before);
  });
  it("orders disabling behind an in-flight booking, then rejects later bookings", async () => {
    let release!: () => void;
    let locked!: () => void;
    const holding = new Promise<void>((resolve) => { release = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const booking = db.$transaction(async (tx) => {
      await assertOnlineReservationsEnabled(tx);
      locked();
      await holding;
    });
    await ready;
    let saved = false;
    const disabling = db.$transaction((tx) => setOnlineReservationsEnabled(tx, false, "test-admin")).then(() => { saved = true; });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(saved).toBe(false);
    release();
    await Promise.all([booking, disabling]);
    await expect(db.$transaction((tx) => assertOnlineReservationsEnabled(tx))).rejects.toMatchObject({ code: "RESERVATIONS_DISABLED" });
    expect(await db.reservation.count()).toBe(1);
  });
});
