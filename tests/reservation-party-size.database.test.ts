import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { db: new PrismaClient({ datasourceUrl: "postgresql://reservation_test@127.0.0.1:55459/reservation_switch_test" }) };
});
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/supabase/auth", () => ({ getAdminUser: vi.fn(async () => ({ id: "test-admin" })) }));
vi.mock("@/lib/sms", () => ({
  sendReservationConfirmationSms: vi.fn(async () => ({ ok: true })),
  sendAdminNewReservationSms: vi.fn(async () => ({ ok: true })),
  sendAdminReservationUpdatedSms: vi.fn(async () => ({ ok: true })),
  sendAdminReservationCancelledSms: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/abuse-protection", () => ({
  consumeRateLimit: vi.fn(async () => ({ ok: true })), PUBLIC_ENDPOINT_RATE_LIMITS: {},
  getPublicClientRateLimitKey: () => "test", getReservationPhoneRateLimitKey: () => "test",
}));
import { db } from "@/lib/db";
import { POST as create } from "@/app/api/reservations/route";
import { POST as availability } from "@/app/api/reservations/availability/route";
import { PATCH as update, DELETE as cancel, GET as read } from "@/app/api/reservations/manage/route";
import { POST as staffCreate } from "@/app/api/admin/reservations/route";
import { PATCH as staffUpdate } from "@/app/api/admin/reservations/[id]/route";
import { sendReservationConfirmationSms, sendAdminNewReservationSms } from "@/lib/sms";

const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const payload = { date, time: "17:00", partySize: 12, name: "Online Limit Test", phone: "+15145550199", language: "EN" };
const ids: string[] = [];
let originalSettings: Awaited<ReturnType<typeof db.settings.findUniqueOrThrow>>;
let sentinel: unknown;
function request(method: string, body: unknown) { return new Request("http://localhost/api", { method, body: JSON.stringify(body) }); }
async function make(partySize: number, staff = false) {
  const response = await (staff ? staffCreate : create)(request("POST", { ...payload, partySize }));
  expect(response.status).toBe(201);
  const result = await response.json();
  ids.push(result.data.reservation.id);
  return db.reservation.findUniqueOrThrow({ where: { id: result.data.reservation.id } });
}
beforeAll(async () => {
  originalSettings = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  sentinel = await db.reservation.findUniqueOrThrow({ where: { id: "availability-sentinel" } });
  await db.settings.update({ where: { id: 1 }, data: { onlineReservationsEnabled: true } });
});
afterEach(async () => {
  await db.reservation.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
});
afterAll(async () => {
  await db.settings.update({ where: { id: 1 }, data: { onlineReservationsEnabled: originalSettings.onlineReservationsEnabled } });
  expect(await db.reservation.findUniqueOrThrow({ where: { id: "availability-sentinel" } })).toEqual(sentinel);
  const after = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  expect({ ...after, updatedAt: originalSettings.updatedAt }).toEqual(originalSettings);
  await db.$disconnect();
});

describe("public and staff reservation API boundaries", () => {
  it("accepts availability at six and twelve with shared 6–12 settings", async () => {
    for (const partySize of [6, 12]) {
      const response = await availability(request("POST", { date, partySize }));
      expect(response.status).toBe(200);
      expect((await response.json()).data.slots.length).toBeGreaterThan(0);
    }
  });
  it("rejects five and thirteen on availability and creation without rows or SMS", async () => {
    const before = await db.reservation.count();
    for (const partySize of [5, 13]) {
      for (const [handler, body] of [[availability, { date, partySize }], [create, { ...payload, partySize }]] as const) {
        const response = await handler(request("POST", body));
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: { code: "INVALID_PARTY_SIZE", message: "Party size must be between 6 and 12." } });
      }
    }
    expect(await db.reservation.count()).toBe(before);
    expect(sendReservationConfirmationSms).not.toHaveBeenCalled();
    expect(sendAdminNewReservationSms).not.toHaveBeenCalled();
  });
  it("creates six and twelve, permits edits within the range, rejects both boundaries without mutation", async () => {
    await make(6);
    const booking = await make(12);
    for (const partySize of [5, 13]) {
      const response = await update(request("PATCH", { token: booking.manageToken, partySize }));
      expect(response.status).toBe(400);
      expect(await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).toEqual(booking);
    }
    expect((await update(request("PATCH", { token: booking.manageToken, partySize: 10 }))).status).toBe(200);
    expect((await staffUpdate(request("PATCH", { partySize: 3 }), { params: Promise.resolve({ id: booking.id }) })).status).toBe(400);
  });
  it("enforces the same bounds for staff creation and edits", async () => {
    for (const partySize of [5, 13, 15]) {
      expect((await staffCreate(request("POST", { ...payload, partySize }))).status).toBe(400);
    }
    const booking = await make(12, true);
    expect((await staffUpdate(request("PATCH", { partySize: 13 }), { params: Promise.resolve({ id: booking.id }) })).status).toBe(400);
    expect((await staffUpdate(request("PATCH", { partySize: 6 }), { params: Promise.resolve({ id: booking.id }) })).status).toBe(200);
  });
  it("uses settings changes for public and staff validation alike", async () => {
    await db.settings.update({ where: { id: 1 }, data: { maxPartySize: 10 } });
    try {
      expect((await availability(request("POST", { date, partySize: 12 }))).status).toBe(400);
      expect((await create(request("POST", payload))).status).toBe(400);
      expect((await staffCreate(request("POST", payload))).status).toBe(400);
    } finally {
      await db.settings.update({ where: { id: 1 }, data: { maxPartySize: 12 } });
    }
  });
  it("preserves valid contact edits, scheduling changes and cancellation", async () => {
    const booking = await make(12);
    const url = `http://localhost/api/reservations/manage?token=${booking.manageToken}`;
    expect((await read(new Request(url))).status).toBe(200);
    expect((await update(request("PATCH", { token: booking.manageToken, name: "Updated Test Contact", time: "18:00" }))).status).toBe(200);
    expect((await cancel(new Request(url, { method: "DELETE" }))).status).toBe(200);
  });
  it.each([4, 15])("preserves reading/cancellation of historical party %i while rejecting invalid edits like July", async (partySize) => {
    const original = await make(6);
    const booking = await db.reservation.update({ where: { id: original.id }, data: { partySize } });
    const url = `http://localhost/api/reservations/manage?token=${booking.manageToken}`;
    expect((await (await read(new Request(url))).json()).data.reservation.partySize).toBe(partySize);
    expect((await update(request("PATCH", { token: booking.manageToken, name: "Rejected Test Change" }))).status).toBe(400);
    expect(await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).toEqual(booking);
    expect((await cancel(new Request(url, { method: "DELETE" }))).status).toBe(200);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).partySize).toBe(partySize);
  });
});
