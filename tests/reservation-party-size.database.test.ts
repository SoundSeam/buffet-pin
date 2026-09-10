import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { db: new PrismaClient({ datasourceUrl: "postgresql://reservation_test@127.0.0.1:55439/reservation_switch_test" }) };
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
const payload = { date, time: "17:00", partySize: 5, name: "Online Limit Test", phone: "+15145550199", language: "EN" };
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
afterAll(async () => {
  await db.reservation.deleteMany({ where: { id: { in: ids } } });
  await db.settings.update({ where: { id: 1 }, data: { onlineReservationsEnabled: originalSettings.onlineReservationsEnabled } });
  expect(await db.reservation.findUniqueOrThrow({ where: { id: "availability-sentinel" } })).toEqual(sentinel);
  const after = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  expect({ ...after, updatedAt: originalSettings.updatedAt }).toEqual(originalSettings);
  await db.$disconnect();
});

describe("public and staff reservation API boundaries", () => {
  it("accepts availability at one and five despite existing 6–15 settings", async () => {
    for (const partySize of [1, 5]) {
      const response = await availability(request("POST", { date, partySize }));
      expect(response.status).toBe(200);
      expect((await response.json()).data.slots.length).toBeGreaterThan(0);
    }
  });
  it("rejects six and fifteen on availability and creation without rows or SMS", async () => {
    const before = await db.reservation.count();
    for (const partySize of [6, 15]) {
      for (const [handler, body] of [[availability, { date, partySize }], [create, { ...payload, partySize }]] as const) {
        const response = await handler(request("POST", body));
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: { code: "INVALID_PARTY_SIZE", message: expect.stringContaining("(450) 699-8088") } });
      }
    }
    expect(await db.reservation.count()).toBe(before);
    expect(sendReservationConfirmationSms).not.toHaveBeenCalled();
    expect(sendAdminNewReservationSms).not.toHaveBeenCalled();
  });
  it("creates one and five, permits editing within the limit, rejects six without mutation", async () => {
    await make(1);
    const booking = await make(5);
    const response = await update(request("PATCH", { token: booking.manageToken, partySize: 6 }));
    expect(response.status).toBe(400);
    expect(await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).toEqual(booking);
    expect((await update(request("PATCH", { token: booking.manageToken, partySize: 4 }))).status).toBe(200);
    expect((await staffUpdate(request("PATCH", { partySize: 3 }), { params: Promise.resolve({ id: booking.id }) })).status).toBe(200);
  });
  it("keeps staff larger bookings and historical management/cancellation working", async () => {
    const booking = await make(6, true);
    const adminResponse = await staffUpdate(request("PATCH", { partySize: 7 }), { params: Promise.resolve({ id: booking.id }) });
    expect(adminResponse.status).toBe(200);
    const url = `http://localhost/api/reservations/manage?token=${booking.manageToken}`;
    expect((await read(new Request(url))).status).toBe(200);
    expect((await update(request("PATCH", { token: booking.manageToken, name: "Updated Test Contact" }))).status).toBe(200);
    expect((await update(request("PATCH", { token: booking.manageToken, time: "18:00" }))).status).toBe(400);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).partySize).toBe(7);
    expect((await cancel(new Request(url, { method: "DELETE" }))).status).toBe(200);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CANCELLED");
  });
  it("permits existing larger bookings to reduce to five", async () => {
    const booking = await make(6, true);
    expect((await update(request("PATCH", { token: booking.manageToken, partySize: 5 }))).status).toBe(200);
  });
});
