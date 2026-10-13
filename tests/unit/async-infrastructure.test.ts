import { describe, expect, it } from "vitest";

import { signAsyncCallback, verifyAsyncCallback } from "../../lib/async-jobs/auth";
import { adminUpdatesChannel, opaqueEntityChannel } from "../../lib/realtime/channels";

describe("async callback authentication", () => {
  it("accepts a fresh body-bound signature", () => {
    const now = new Date("2026-08-12T12:00:00.000Z");
    const body = JSON.stringify({ jobId: "job-1" });
    const authorization = signAsyncCallback("a".repeat(48), "1786536000", body);
    expect(verifyAsyncCallback({ secret: "a".repeat(48), authorization, body, now })).toBe(true);
  });

  it("rejects tampering and expired signatures", () => {
    const secret = "b".repeat(48);
    const authorization = signAsyncCallback(secret, "1786536000", "{}");
    expect(verifyAsyncCallback({ secret, authorization, body: '{"jobId":"changed"}', now: new Date("2026-08-12T12:00:00.000Z") })).toBe(false);
    expect(verifyAsyncCallback({ secret, authorization, body: "{}", now: new Date("2026-08-12T12:10:01.000Z") })).toBe(false);
  });
});

describe("realtime channels", () => {
  it("uses a stable opaque identifier rather than exposing the database ID", () => {
    const channel = opaqueEntityChannel("order", "order-secret-id", "c".repeat(48));
    expect(channel).toMatch(/^\/updates\/order\/[A-Za-z0-9_-]{43}$/);
    expect(channel).not.toContain("order-secret-id");
    expect(adminUpdatesChannel).toBe("/updates/admin");
  });
});
