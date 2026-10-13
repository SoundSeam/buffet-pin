export const DISPOSABLE_TEST_DATABASE_URL =
  "postgresql://buffet_pin_test:buffet_pin_test@127.0.0.1:55432/buffet_pin_test?schema=public";

export function assertIsolatedTestDatabaseUrl(value) {
  if (!value) {
    throw new Error("TEST_DATABASE_URL is required.");
  }

  const url = new URL(value);
  const expected = new URL(DISPOSABLE_TEST_DATABASE_URL);
  if (
    url.protocol !== expected.protocol ||
    url.hostname !== expected.hostname ||
    url.port !== expected.port ||
    url.username !== expected.username ||
    url.password !== expected.password ||
    url.pathname !== expected.pathname ||
    url.search !== expected.search ||
    url.hash !== ""
  ) {
    throw new Error(
      "Database verification is locked to the disposable Docker database on 127.0.0.1:55432.",
    );
  }

  return value;
}
