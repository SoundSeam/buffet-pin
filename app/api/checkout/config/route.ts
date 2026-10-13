import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET() {
  const env = getEnv();

  if (env.CLOVER_CHECKOUT_MODE === "hosted") {
    return NextResponse.json({
      ok: true,
      data: {
        checkoutMode: "hosted",
      },
    });
  }

  const missingKeys = [
    !env.CLOVER_ENV ? "CLOVER_ENV" : null,
    !env.CLOVER_MERCHANT_ID ? "CLOVER_MERCHANT_ID" : null,
    !env.CLOVER_PUBLIC_ACCESS_KEY ? "CLOVER_PUBLIC_ACCESS_KEY" : null,
  ].filter(Boolean);

  if (missingKeys.length > 0) {
    return errorResponse(
      503,
      "CLOVER_IFRAME_CONFIG_ERROR",
      `Clover iframe checkout is not configured. Missing: ${missingKeys.join(", ")}.`,
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      checkoutMode: "iframe",
      clover: {
        env: env.CLOVER_ENV,
        merchantId: env.CLOVER_MERCHANT_ID,
        publicAccessKey: env.CLOVER_PUBLIC_ACCESS_KEY,
        sdkUrl:
          env.CLOVER_ENV === "sandbox"
            ? "https://checkout.sandbox.dev.clover.com/sdk.js"
            : "https://checkout.clover.com/sdk.js",
      },
    },
  });
}
