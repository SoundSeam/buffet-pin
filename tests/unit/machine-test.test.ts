import { describe, expect, it } from "vitest";

import {
  diagnoseMachineTestOrder,
  describeMachineTestEnvironment,
  getMachineTestEligibilityError,
  summarizeMachineTestOrder,
} from "../../lib/operations/machine-test";

describe("machine test status", () => {
  it("reports only safe Clover configuration facts", () => {
    const summary = describeMachineTestEnvironment(
      {
        DATABASE_URL: "postgres://example",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public",
        GEOCODING_PROVIDER: "none",
        CLOVER_CHECKOUT_MODE: "iframe",
        CLOVER_ENV: "sandbox",
        CLOVER_MERCHANT_ID: "merchant-123456",
        CLOVER_PUBLIC_ACCESS_KEY: "public-access-key",
        CLOVER_PLATFORM_TOKEN: "platform-secret",
        CLOVER_ECOMMERCE_PRIVATE_TOKEN: "payment-secret",
        CLOVER_WEBHOOK_SECRET: "webhook-secret",
        CLOVER_PLATFORM_WEBHOOK_AUTH: "platform-webhook-secret",
        ORDERING_TEST_BYPASS: false,
        PROVIDER_MODE: "real",
        FAILURE_INJECTION_ENABLED: false,
        ASYNC_JOBS_MODE: "inline",
        AWS_REGION: "us-east-2",
      NEXT_PUBLIC_REALTIME_MODE: "poll",
      ORDER_EMAIL_PROVIDER: "disabled",
      },
      "development",
    );

    expect(summary).toEqual({
      testScope: "local:real:sandbox:3456",
      runtime: "local",
      orderingTestBypass: false,
      providerMode: "real",
      cloverEnvironment: "sandbox",
      cloverConfigured: true,
      merchantHint: "ends in 3456",
      paymentWebhookConfigured: true,
      platformWebhookConfigured: true,
    });
    expect(JSON.stringify(summary)).not.toContain("secret");
  });

  it("fails closed unless the runner is local, real, bypassed, live, and fully configured", () => {
    const eligible = {
      testScope: "local:real:production:3456",
      runtime: "local" as const,
      orderingTestBypass: true,
      providerMode: "real" as const,
      cloverEnvironment: "production" as const,
      cloverConfigured: true,
      merchantHint: "ends in 3456",
      paymentWebhookConfigured: false,
      platformWebhookConfigured: false,
    };

    expect(getMachineTestEligibilityError(eligible)).toBeNull();
    expect(getMachineTestEligibilityError({ ...eligible, runtime: "deployed", orderingTestBypass: false })).toBeNull();
    expect(getMachineTestEligibilityError({ ...eligible, providerMode: "fake" })).toMatchObject({ code: "FAKE_PROVIDER" });
    expect(getMachineTestEligibilityError({ ...eligible, orderingTestBypass: false })).toMatchObject({ code: "LOCAL_TEST_BYPASS_REQUIRED" });
    expect(getMachineTestEligibilityError({ ...eligible, cloverEnvironment: "sandbox" })).toMatchObject({ code: "LIVE_CLOVER_REQUIRED" });
    expect(getMachineTestEligibilityError({ ...eligible, cloverConfigured: false })).toMatchObject({ code: "CLOVER_NOT_CONFIGURED" });
  });

  it("shows missing physical-flow facts without guessing success", () => {
    const order = summarizeMachineTestOrder({
      id: "order-1",
      orderNumber: "BP-260803-0001",
      paymentStatus: "PENDING",
      fulfillmentStatus: "AWAITING_PAYMENT",
      createdAt: new Date("2026-08-03T12:00:00.000Z"),
      externalOrders: [],
      printJobs: [],
    });

    expect(order).toMatchObject({
      cloverOrderState: "NOT CREATED",
      cloverOrderRecorded: false,
      printStatus: "NO PRINT INTENT",
      printPurpose: null,
      printErrorCode: null,
    });
  });

  it("turns one tracked order into plain-English machine diagnostics", () => {
    const base = {
      id: "order-1",
      orderNumber: "BP-260803-0001",
      fulfillmentStatus: "AWAITING_ACCEPTANCE",
      cloverOrderRecorded: true,
      printPurpose: "INITIAL",
      printErrorCode: null,
      createdAt: "2026-08-03T12:00:00.000Z",
    };

    expect(diagnoseMachineTestOrder({
      ...base,
      paymentStatus: "PENDING",
      cloverOrderState: "CREATED",
      printStatus: "NO PRINT INTENT",
    }).title).toBe("Waiting for payment");

    expect(diagnoseMachineTestOrder({
      ...base,
      paymentStatus: "PAID",
      cloverOrderState: "CREATED",
      printStatus: "SUBMITTED",
    }).title).toBe("Check the SP700");

    expect(diagnoseMachineTestOrder({
      ...base,
      paymentStatus: "PAID",
      cloverOrderState: "CREATED",
      printStatus: "UNKNOWN",
    })).toMatchObject({ level: "STOP", title: "Print result is uncertain" });
  });
});
