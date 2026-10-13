import {
  CloverEcommerceChargeError,
  CloverEcommerceConfigError,
} from "@/lib/clover/ecommerce";
import { CloverOrderTotalMismatchError } from "@/lib/clover/platform-orders";

export type EcommerceFailureDetails = {
  code: string;
  message: string;
  status: number;
  terminal: boolean;
  providerStatus?: number;
  providerResponse?: unknown;
};

export function getEcommerceFailureDetails(error: unknown): EcommerceFailureDetails {
  if (error instanceof CloverOrderTotalMismatchError) {
    return {
      code: "CLOVER_ORDER_TOTAL_MISMATCH",
      message: "Clover calculated a different order total. No payment was attempted.",
      status: 409,
      terminal: true,
    };
  }

  if (
    error instanceof Error &&
    error.message.startsWith("Clover Hosted Checkout is not configured.")
  ) {
    return {
      code: "CLOVER_CONFIG_ERROR",
      message: error.message,
      status: 503,
      terminal: true,
    };
  }

  if (error instanceof CloverEcommerceConfigError) {
    return {
      code: "CLOVER_CONFIG_ERROR",
      message: error.message,
      status: 400,
      terminal: true,
    };
  }

  if (error instanceof CloverEcommerceChargeError) {
    const isDecline =
      error.status >= 400 &&
      error.status < 500 &&
      ![408, 409, 429].includes(error.status);

    return {
      code: isDecline ? "CLOVER_PAYMENT_DECLINED" : "CLOVER_ECOMMERCE_API_ERROR",
      message: isDecline
        ? "Clover declined this payment."
        : "Clover Ecommerce payment could not be completed.",
      status: isDecline ? 402 : 502,
      terminal: isDecline,
      providerStatus: error.status,
      providerResponse: error.responseBody,
    };
  }

  return {
    code: "CLOVER_ECOMMERCE_ERROR",
    message: "Clover Ecommerce payment could not be completed.",
    status: 502,
    terminal: false,
  };
}
