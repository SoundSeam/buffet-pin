import { describe, expect, it } from "vitest";
import {
  DISPOSABLE_TEST_DATABASE_URL,
  assertIsolatedTestDatabaseUrl,
} from "../../scripts/database-guard.mjs";

describe("isolated test database guard", () => {
  it("accepts only the dedicated loopback test database", () => {
    expect(assertIsolatedTestDatabaseUrl(DISPOSABLE_TEST_DATABASE_URL)).toBe(
      DISPOSABLE_TEST_DATABASE_URL,
    );
  });

  it.each([
    "postgresql://app:secret@production.example.com/orders_test",
    "postgresql://app:secret@127.0.0.1:55432/orders_test",
    "postgresql://buffet_pin_test:secret@127.0.0.1:55432/orders",
    "postgresql://buffet_pin_test:buffet_pin_test@127.0.0.1:55433/buffet_pin_test?schema=public",
    "postgresql://buffet_pin_test:buffet_pin_test@127.0.0.1:55432/other_test?schema=public",
    "postgresql://buffet_pin_test:buffet_pin_test@127.0.0.1:55432/buffet_pin_test?schema=other",
    "postgresql://buffet_pin_test:buffet_pin_test@127.0.0.1:55432/buffet_pin_test?schema=public&sslmode=require",
  ])("rejects unsafe database URL %s", (url) => {
    expect(() => assertIsolatedTestDatabaseUrl(url)).toThrow();
  });
});
