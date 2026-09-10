import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), transaction: vi.fn(), rateLimit: vi.fn(), getAdminUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { settings: { findUnique: mocks.findUnique }, $transaction: mocks.transaction } }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/supabase/auth", () => ({ getAdminUser: mocks.getAdminUser }));
vi.mock("@/lib/sms", () => ({ sendReservationConfirmationSms: vi.fn(), sendAdminNewReservationSms: vi.fn() }));
vi.mock("@/lib/abuse-protection", () => ({
  consumeRateLimit: mocks.rateLimit, PUBLIC_ENDPOINT_RATE_LIMITS: {},
  getPublicClientRateLimitKey: () => "test", getReservationPhoneRateLimitKey: () => "test",
}));

import { getOnlineReservationsEnabled } from "@/lib/reservations/availability";
import { POST as create } from "@/app/api/reservations/route";
import { POST as availability } from "@/app/api/reservations/availability/route";
import { GET as status } from "@/app/api/reservations/status/route";
import { GET as settings, PATCH } from "@/app/api/admin/settings/route";

beforeEach(() => {
  mocks.findUnique.mockResolvedValue({ onlineReservationsEnabled: false });
  mocks.rateLimit.mockResolvedValue({ ok: true });
});

describe("online reservation switch", () => {
  it("fails closed for missing settings and database errors", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await getOnlineReservationsEnabled()).toBe(false);
    mocks.findUnique.mockRejectedValue(new Error("offline"));
    expect(await getOnlineReservationsEnabled()).toBe(false);
  });
  it("reads fresh availability on subsequent calls", async () => {
    expect(await getOnlineReservationsEnabled()).toBe(false);
    mocks.findUnique.mockResolvedValue({ onlineReservationsEnabled: true });
    expect(await getOnlineReservationsEnabled()).toBe(true);
  });
  it("exposes only the public Boolean with caching disabled", async () => {
    const response = await status();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ onlineReservationsEnabled: false });
  });
  for (const [name, handler] of [["booking", create], ["availability", availability]] as const) {
    it(`blocks ${name} before parsing or side effects`, async () => {
      const request = new Request("http://localhost/api", { method: "POST", body: "not json" });
      const read = vi.spyOn(request, "json");
      const response = await handler(request);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: "RESERVATIONS_DISABLED" } });
      expect(read).not.toHaveBeenCalled();
      expect(mocks.rateLimit).not.toHaveBeenCalled();
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it(`restores normal ${name} validation when enabled`, async () => {
      mocks.findUnique.mockResolvedValue({ onlineReservationsEnabled: true });
      const response = await handler(new Request("http://localhost/api", { method: "POST", body: "not json" }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "INVALID_JSON" } });
      expect(mocks.rateLimit).toHaveBeenCalledOnce();
    });
  }
  it("denies unauthenticated settings reads and writes", async () => {
    mocks.getAdminUser.mockResolvedValue(null);
    expect((await settings()).status).toBe(401);
    expect((await PATCH(new Request("http://localhost/api", { method: "PATCH", body: '{"onlineReservationsEnabled":true}' }))).status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects string booleans for an authenticated administrator", async () => {
    mocks.getAdminUser.mockResolvedValue({ id: "test-admin" });
    const response = await PATCH(new Request("http://localhost/api", { method: "PATCH", body: '{"onlineReservationsEnabled":"false"}' }));
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
