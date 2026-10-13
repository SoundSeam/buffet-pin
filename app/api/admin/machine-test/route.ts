import { NextResponse } from "next/server";

import { CloverApiError, createCloverClient } from "@/lib/clover/client";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  describeMachineTestEnvironment,
  getMachineTestEligibilityError,
  summarizeMachineTestOrder,
} from "@/lib/operations/machine-test";
import {
  issueMachineTestGrant,
  MACHINE_TEST_GRANT_COOKIE,
  MACHINE_TEST_GRANT_TTL_SECONDS,
} from "@/lib/operations/machine-test-grant";
import { getStaffUserWithAnyCapability } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Manager access required." },
    },
    { status: 401 },
  );
}

export async function GET() {
  if (!(await getStaffUserWithAnyCapability(["SETTINGS_WRITE", "DEV_TOOLS"]))) {
    return unauthorized();
  }

  const [settings, orders] = await Promise.all([
    db.restaurantOrderSettings.findUnique({
      where: { id: 1 },
      select: {
        onlineOrderingEnabled: true,
        deliveryEnabled: true,
        maxActiveOrders: true,
      },
    }),
    db.order.findMany({
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        createdAt: true,
        externalOrders: {
          where: { provider: "CLOVER" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { state: true, providerOrderId: true },
        },
        printJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            purpose: true,
            status: true,
            lastErrorCode: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      environment: describeMachineTestEnvironment(
        getEnv(),
        process.env.NODE_ENV,
      ),
      settings: {
        onlineOrderingEnabled: settings?.onlineOrderingEnabled ?? false,
        deliveryEnabled: settings?.deliveryEnabled ?? false,
        maxActiveOrders: settings?.maxActiveOrders ?? null,
      },
      orders: orders.map(summarizeMachineTestOrder),
      observedAt: new Date().toISOString(),
    },
  });
}

export async function POST() {
  const actor = await getStaffUserWithAnyCapability([
    "SETTINGS_WRITE",
    "DEV_TOOLS",
  ]);
  if (!actor) return unauthorized();

  const environment = describeMachineTestEnvironment(
    getEnv(),
    process.env.NODE_ENV,
  );
  const eligibilityError = getMachineTestEligibilityError(environment);
  if (eligibilityError) {
    return NextResponse.json(
      { ok: false, error: eligibilityError },
      { status: 409 },
    );
  }

  const settings = await db.restaurantOrderSettings.findUnique({
    where: { id: 1 },
    select: { onlineOrderingEnabled: true },
  });
  if (settings?.onlineOrderingEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PUBLIC_ORDERING_MUST_BE_OFF",
          message:
            "Public online ordering is ON. Turn it OFF before this live machine test.",
        },
      },
      { status: 409 },
    );
  }

  try {
    const client = createCloverClient();
    const merchant = await client.get<{ id?: string; name?: string }>(
      `/v3/merchants/${encodeURIComponent(client.config.merchantId)}`,
    );
    if (merchant.id !== client.config.merchantId) {
      throw new Error("Clover returned a different merchant.");
    }
    const testGrant =
      environment.runtime === "deployed"
        ? await issueMachineTestGrant({
            staffId: actor.staff.id,
            label: actor.staff.displayName,
          })
        : null;
    const response = NextResponse.json({
      ok: true,
      data: {
        connected: true,
        merchantName: merchant.name?.trim() || "Clover merchant",
        merchantHint: environment.merchantHint,
        cloverEnvironment: environment.cloverEnvironment,
        testPassExpiresAt: testGrant?.grant.expiresAt.toISOString() ?? null,
        checkedAt: new Date().toISOString(),
      },
    });
    if (testGrant) {
      response.cookies.set(MACHINE_TEST_GRANT_COOKIE, testGrant.rawToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: MACHINE_TEST_GRANT_TTL_SECONDS,
      });
    }
    return response;
  } catch (error) {
    const message =
      error instanceof CloverApiError
        ? error.status === 401 || error.status === 403
          ? "Clover rejected the credentials or permissions."
          : error.status === 404
            ? "Clover could not find this merchant. Check the merchant ID."
            : error.status === 429
              ? "Clover is rate-limiting requests. Wait before testing again."
              : "Clover is not responding normally right now."
        : "The app could not reach Clover. Check internet access and configuration.";
    return NextResponse.json(
      { ok: false, error: { code: "CLOVER_CONNECTION_FAILED", message } },
      { status: 502 },
    );
  }
}
