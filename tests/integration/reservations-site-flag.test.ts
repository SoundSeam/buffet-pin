import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ RESERVATIONS_ENABLED: false }));
const effects = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  transaction: vi.fn(),
  dispatch: vi.fn(),
  confirmationSms: vi.fn(),
  adminSms: vi.fn(),
}));
vi.mock("@/lib/reservations/availability", () => ({
  getOnlineReservationsEnabled: async () => flags.RESERVATIONS_ENABLED,
  assertOnlineReservationsEnabled: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: effects.transaction } }));
vi.mock("@/lib/abuse-protection", () => ({
  PUBLIC_ENDPOINT_RATE_LIMITS: {},
  consumeRateLimit: effects.consumeRateLimit,
  getPublicClientRateLimitKey: () => "test-client",
  getReservationPhoneRateLimitKey: () => "test-phone",
}));
vi.mock("@/lib/async-jobs/dispatch", () => ({ dispatchAggregateJobs: effects.dispatch }));
vi.mock("@/lib/sms", () => ({
  sendAdminNewReservationSms: effects.adminSms,
  sendReservationConfirmationSms: effects.confirmationSms,
}));

import { POST as createReservation } from "@/app/api/reservations/route";
import { POST as availability } from "@/app/api/reservations/availability/route";

describe("public reservation flag", () => {
  beforeEach(() => {
    flags.RESERVATIONS_ENABLED = false;
    effects.consumeRateLimit.mockResolvedValue({ ok: true });
  });

  for (const [name, handler] of [["creation", createReservation], ["availability", availability]] as const) {
    it(`blocks ${name} before reading the body or producing side effects`, async () => {
      const request = new Request("http://localhost/api/reservations", { method: "POST", body: "invalid json" });
      const read = vi.spyOn(request, "json");
      const response = await handler(request);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ ok: false, error: { code: "RESERVATIONS_DISABLED" } });
      expect(read).not.toHaveBeenCalled();
      for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
    });

    it(`restores normal ${name} request validation when enabled`, async () => {
      flags.RESERVATIONS_ENABLED = true;
      const response = await handler(new Request("http://localhost/api/reservations", { method: "POST", body: "invalid json" }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "INVALID_JSON" } });
      expect(effects.consumeRateLimit).toHaveBeenCalledOnce();
      expect(effects.transaction).not.toHaveBeenCalled();
    });
  }

});
