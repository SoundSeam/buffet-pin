import type { ExternalOrder, Order, PrintJob } from "@prisma/client";

import type { AppEnv } from "@/lib/env";

export type MachineTestEnvironment = {
  testScope: string;
  runtime: "local" | "deployed";
  orderingTestBypass: boolean;
  providerMode: "fake" | "real";
  cloverEnvironment: "sandbox" | "production" | "not configured";
  cloverConfigured: boolean;
  merchantHint: string | null;
  paymentWebhookConfigured: boolean;
  platformWebhookConfigured: boolean;
};

export type MachineTestOrder = {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  cloverOrderState: string;
  cloverOrderRecorded: boolean;
  printStatus: string;
  printPurpose: string | null;
  printErrorCode: string | null;
  createdAt: string;
};

export type MachineTestDiagnosis = {
  level: "WAIT" | "PASS" | "FAIL" | "STOP";
  title: string;
  detail: string;
};

export type MachineTestEligibilityError = {
  code: string;
  message: string;
};

export function describeMachineTestEnvironment(
  env: AppEnv,
  nodeEnv: string | undefined,
): MachineTestEnvironment {
  const cloverConfigured = Boolean(
    env.CLOVER_ENV &&
      env.CLOVER_MERCHANT_ID &&
      env.CLOVER_CHECKOUT_MODE === "iframe" &&
      env.CLOVER_PUBLIC_ACCESS_KEY &&
      env.CLOVER_PLATFORM_TOKEN &&
      env.CLOVER_ECOMMERCE_PRIVATE_TOKEN,
  );

  return {
    testScope: [
      nodeEnv === "production" ? "deployed" : "local",
      env.PROVIDER_MODE,
      env.CLOVER_ENV ?? "not-configured",
      env.CLOVER_MERCHANT_ID?.slice(-4) ?? "no-merchant",
    ].join(":"),
    runtime: nodeEnv === "production" ? "deployed" : "local",
    orderingTestBypass: env.ORDERING_TEST_BYPASS,
    providerMode: env.PROVIDER_MODE,
    cloverEnvironment: env.CLOVER_ENV ?? "not configured",
    cloverConfigured,
    merchantHint: env.CLOVER_MERCHANT_ID
      ? `ends in ${env.CLOVER_MERCHANT_ID.slice(-4)}`
      : null,
    paymentWebhookConfigured: Boolean(env.CLOVER_WEBHOOK_SECRET),
    platformWebhookConfigured: Boolean(env.CLOVER_PLATFORM_WEBHOOK_AUTH),
  };
}

export function getMachineTestEligibilityError(
  environment: MachineTestEnvironment,
): MachineTestEligibilityError | null {
  if (environment.providerMode !== "real") {
    return {
      code: "FAKE_PROVIDER",
      message: "This app is using fake providers, so it cannot reach Clover or the SP700.",
    };
  }
  if (environment.runtime === "local" && !environment.orderingTestBypass) {
    return {
      code: "LOCAL_TEST_BYPASS_REQUIRED",
      message: "Set ORDERING_TEST_BYPASS=true in .env.local, restart the local app, and keep public ordering OFF.",
    };
  }
  if (environment.cloverEnvironment !== "production") {
    return {
      code: "LIVE_CLOVER_REQUIRED",
      message: "This test only runs against the live restaurant Clover account. Set CLOVER_ENV=production with the owner's approved credentials.",
    };
  }
  if (!environment.cloverConfigured) {
    return {
      code: "CLOVER_NOT_CONFIGURED",
      message: "Live Clover checkout is incomplete. It needs the merchant ID, Platform token, Ecommerce token, iframe mode, and public key.",
    };
  }
  return null;
}

type MachineOrderSource = Pick<
  Order,
  "id" | "orderNumber" | "paymentStatus" | "fulfillmentStatus" | "createdAt"
> & {
  externalOrders: Array<Pick<ExternalOrder, "state" | "providerOrderId">>;
  printJobs: Array<
    Pick<PrintJob, "purpose" | "status" | "lastErrorCode" | "createdAt">
  >;
};

export function summarizeMachineTestOrder(order: MachineOrderSource): MachineTestOrder {
  const cloverOrder = order.externalOrders[0];
  const printJob = order.printJobs[0];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    cloverOrderState: cloverOrder?.state ?? "NOT CREATED",
    cloverOrderRecorded: Boolean(cloverOrder?.providerOrderId),
    printStatus: printJob?.status ?? "NO PRINT INTENT",
    printPurpose: printJob?.purpose ?? null,
    printErrorCode: printJob?.lastErrorCode ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}

export function diagnoseMachineTestOrder(
  order: MachineTestOrder,
): MachineTestDiagnosis {
  if (order.paymentStatus === "FAILED") {
    return {
      level: "FAIL",
      title: "Payment failed",
      detail: "No ticket should print. Start a new test order if the payment failure was expected.",
    };
  }
  if (order.paymentStatus !== "PAID") {
    return {
      level: "WAIT",
      title: "Waiting for payment",
      detail: "Finish the Clover payment window. Do not pay or refresh twice.",
    };
  }
  if (["UNKNOWN", "TOTAL_MISMATCH"].includes(order.cloverOrderState)) {
    return {
      level: "STOP",
      title: "Clover order is uncertain",
      detail: "Stop. Check Clover before trying anything again.",
    };
  }
  if (order.cloverOrderState !== "CREATED") {
    return {
      level: "FAIL",
      title: "Clover order was not created",
      detail: "Payment is confirmed, but the Clover order is not ready. Do not send a manual duplicate.",
    };
  }
  if (order.printStatus === "UNKNOWN") {
    return {
      level: "STOP",
      title: "Print result is uncertain",
      detail: "Look at the SP700 and Clover first. Do not press print again.",
    };
  }
  if (order.printStatus === "FAILED") {
    return {
      level: "FAIL",
      title: "Clover rejected the print request",
      detail: order.printErrorCode
        ? `Error ${order.printErrorCode}. Check the Clover printer setup, then use the controlled recovery screen.`
        : "Check the Clover printer setup, then use the controlled recovery screen.",
    };
  }
  if (order.printStatus === "NO PRINT INTENT") {
    return {
      level: "FAIL",
      title: "Paid order has no print request",
      detail: "The app confirmed payment but did not create the required kitchen-print job.",
    };
  }
  if (["PENDING", "SUBMITTING"].includes(order.printStatus)) {
    return {
      level: "WAIT",
      title: "Sending the ticket",
      detail: "Wait. The app is still sending the one allowed initial print request.",
    };
  }
  if (["SUBMITTED", "PRINTING"].includes(order.printStatus)) {
    return {
      level: "WAIT",
      title: "Check the SP700",
      detail: "Clover accepted the request. Tell the test what physically came out of the printer.",
    };
  }
  if (order.printStatus === "PRINTED") {
    return {
      level: "PASS",
      title: "App path completed",
      detail: "Clover reports the ticket printed. Confirm what physically came out of the SP700.",
    };
  }
  return {
    level: "STOP",
    title: "Unexpected print state",
    detail: `Stop and inspect the order before retrying. Current state: ${order.printStatus}.`,
  };
}
