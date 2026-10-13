import {
  OrderActorType,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  PaymentProvider,
  OrderServiceType,
  Prisma,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { CloverApiError } from "@/lib/clover/client";
import { createHostedCheckoutSession } from "@/lib/clover/checkout";
import { ensureCloverExternalOrder } from "@/lib/clover/platform-orders";
import { submitInitialPrintForOrder } from "@/lib/clover/print-orders";
import {
  createCloverEcommerceCharge,
} from "@/lib/clover/ecommerce";
import { getEcommerceFailureDetails } from "@/lib/clover/ecommerce-failures";
import { db } from "@/lib/db";
import { dispatchAggregateJobs } from "@/lib/async-jobs/dispatch";
import { consumeRateLimit, getPublicClientRateLimitKey, PUBLIC_ENDPOINT_RATE_LIMITS } from "@/lib/abuse-protection";
import { getAppUrl, getCloverCheckoutMode, isOrderingTestBypassEnabled } from "@/lib/env";
import { generatePublicOrderCode } from "@/lib/orders/codes";
import { DeliveryValidationError } from "@/lib/orders/delivery";
import { createOrderIdentity } from "@/lib/orders/identity";
import { checkoutIdempotencyMatches, checkoutRequestFingerprint } from "@/lib/orders/checkout-idempotency";
import { enforceOrderIntakeControls } from "@/lib/orders/intake";
import { notifyPaymentConfirmed } from "@/lib/orders/notifications";
import {
  confirmPaymentInTransaction,
  failPendingPaymentInTransaction,
} from "@/lib/orders/payment-state";
import { ensureInitialPrintIntentInTransaction } from "@/lib/orders/print-jobs";
import { OrderPricingError, priceCart } from "@/lib/orders/pricing";
import {
  attachMachineTestGrantToOrderInTransaction,
  MACHINE_TEST_GRANT_COOKIE,
} from "@/lib/operations/machine-test-grant";
import {
  type CheckoutCreateInput,
  checkoutCreateSchema,
} from "@/lib/orders/validation";

export const dynamic = "force-dynamic";

const MAX_PUBLIC_CODE_ATTEMPTS = 5;

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function normalizePhoneForLookup(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getForwardedFor(request: Request): string | null {
  return request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
}

function buildTrackingUrl(trackingToken: string): string {
  return new URL(`/order/${encodeURIComponent(trackingToken)}`, getAppUrl()).toString();
}

function redactCloverSource<TValue>(value: TValue): TValue {
  if (value && typeof value === "object" && "source" in value) {
    return {
      ...value,
      source: "[redacted]",
    };
  }

  return value;
}

type ExistingPaymentWithOrder = NonNullable<
  Awaited<ReturnType<typeof findExistingPaymentByProviderPaymentId>>
>;

async function upsertCustomer(
  tx: Prisma.TransactionClient,
  customer: CheckoutCreateInput["customer"],
) {
  const normalizedPhone = normalizePhoneForLookup(customer.phone);
  const existing = await tx.customer.findFirst({
    where: { phone: normalizedPhone || customer.phone.trim() },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return tx.customer.update({
      where: { id: existing.id },
      data: {
        name: customer.name,
        email: customer.email,
        language: customer.language,
      },
    });
  }

  return tx.customer.create({
    data: {
      name: customer.name,
      phone: normalizedPhone || customer.phone.trim(),
      email: customer.email,
      language: customer.language,
    },
  });
}

async function upsertCustomerAddress(
  tx: Prisma.TransactionClient,
  customerId: string,
  pricedCart: Awaited<ReturnType<typeof priceCart>>,
) {
  if (pricedCart.serviceType !== OrderServiceType.DELIVERY || !pricedCart.delivery) {
    return null;
  }

  const { address } = pricedCart.delivery;
  const existing = await tx.customerAddress.findFirst({
    where: {
      customerId,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
    },
    orderBy: { createdAt: "asc" },
  });

  const data = {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    country: address.country,
    latitude: pricedCart.delivery.latitude,
    longitude: pricedCart.delivery.longitude,
    deliveryInstructions: address.deliveryInstructions,
  };

  if (existing) {
    return tx.customerAddress.update({
      where: { id: existing.id },
      data,
    });
  }

  return tx.customerAddress.create({
    data: {
      customerId,
      ...data,
    },
  });
}

async function createPendingOrder(
  tx: Prisma.TransactionClient,
  payload: CheckoutCreateInput,
  publicCode: string,
  machineTestGrantToken: string | null,
) {
  const settings = await enforceOrderIntakeControls(tx, {
    allowDisabledForTest: isOrderingTestBypassEnabled(),
    machineTestGrantToken,
  });
  const pricedCart = await priceCart(payload, tx, {
    bypassAvailability: Boolean(settings.machineTestGrantId),
  });

  const customer = await upsertCustomer(tx, payload.customer);
  const customerAddress = await upsertCustomerAddress(tx, customer.id, pricedCart);
  const delivery = pricedCart.delivery;
  const now = new Date();
  const identity = await createOrderIdentity(tx, now);
  const prepMinutes =
    settings.defaultDeliveryPrepMinutes +
    (settings.busyModeEnabled ? settings.busyModeExtraMinutes : 0);
  const estimatedReadyStartAt = new Date(now.getTime() + prepMinutes * 60_000);
  const estimatedReadyEndAt = new Date(estimatedReadyStartAt.getTime() + 15 * 60_000);
  const estimatedDeliveryStartAt = new Date(estimatedReadyEndAt.getTime() + 30 * 60_000);
  const estimatedDeliveryEndAt = new Date(estimatedReadyEndAt.getTime() + 60 * 60_000);
  const dispatchDeadlineAt = new Date(estimatedDeliveryEndAt.getTime() - 30 * 60_000);

  const order = await tx.order.create({
    data: {
      publicCode,
      ...identity,
      serviceType: pricedCart.serviceType,
      paymentStatus: OrderPaymentStatus.PENDING,
      fulfillmentStatus: OrderFulfillmentStatus.AWAITING_PAYMENT,
      customerId: customer.id,
      customerAddressId: customerAddress?.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      deliveryAddressLine1: delivery?.address.addressLine1,
      deliveryAddressLine2: delivery?.address.addressLine2,
      deliveryCity: delivery?.address.city,
      deliveryProvince: delivery?.address.province,
      deliveryPostalCode: delivery?.address.postalCode,
      deliveryCountry: delivery?.address.country,
      deliveryLatitude: delivery?.latitude,
      deliveryLongitude: delivery?.longitude,
      deliveryDistanceKm: delivery?.distanceKm,
      deliveryZoneIdSnapshot: delivery?.zoneId,
      deliveryZoneNameSnapshot: delivery?.zoneName,
      deliveryInstructions: delivery?.address.deliveryInstructions,
      isAsap: true,
      requestedFor: null,
      estimatedReadyStartAt,
      estimatedReadyEndAt,
      estimatedDeliveryStartAt,
      estimatedDeliveryEndAt,
      promisedDeliveryStartAt: estimatedDeliveryStartAt,
      promisedDeliveryEndAt: estimatedDeliveryEndAt,
      dispatchDeadlineAt,
      itemsSubtotalCents: pricedCart.itemsSubtotalCents,
      taxableSubtotalCents: pricedCart.taxableSubtotalCents,
      gstCents: pricedCart.gstCents,
      qstCents: pricedCart.qstCents,
      taxCents: pricedCart.taxCents,
      tipCents: pricedCart.tipCents,
      deliveryFeeCents: pricedCart.deliveryFeeCents,
      discountCents: pricedCart.discountCents,
      totalCents: pricedCart.totalCents,
      currency: pricedCart.currency,
      customerNotes: payload.customerNotes,
      items: {
        create: pricedCart.items.map((item) => ({
          menuItemId: item.menuItemId,
          menuItemNameSnapshot: item.menuItemNameSnapshot,
          menuItemDescriptionSnapshot: item.menuItemDescriptionSnapshot,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          modifiersTotalCents: item.modifiersTotalCents,
          lineSubtotalCents: item.lineSubtotalCents,
          specialInstructions: item.specialInstructions,
          sortOrder: item.sortOrder,
          modifiers: {
            create: item.modifiers.map((modifier) => ({
              modifierGroupId: modifier.modifierGroupId,
              modifierOptionId: modifier.modifierOptionId,
              modifierGroupNameSnapshot: modifier.modifierGroupNameSnapshot,
              modifierOptionNameSnapshot: modifier.modifierOptionNameSnapshot,
              priceDeltaCents: modifier.priceDeltaCents,
              quantity: modifier.quantity,
            })),
          },
        })),
      },
      payments: {
        create: {
          provider: PaymentProvider.CLOVER,
          status: OrderPaymentStatus.PENDING,
          amountCents: pricedCart.totalCents,
          currency: pricedCart.currency,
          providerIdempotencyKey: payload.cloverPayment?.idempotencyKey ?? null,
          checkoutRequestFingerprint: checkoutRequestFingerprint(payload),
        },
      },
      events: {
        create: {
          actorType: OrderActorType.CUSTOMER,
          eventType: "ORDER_CREATED_AWAITING_PAYMENT",
          toPaymentStatus: OrderPaymentStatus.PENDING,
          toFulfillmentStatus: OrderFulfillmentStatus.AWAITING_PAYMENT,
          message: "Customer created checkout order. Payment is pending.",
          metadata: {
            serviceType: pricedCart.serviceType,
            totalCents: pricedCart.totalCents,
            deliveryDistanceKm: delivery?.distanceKm ?? null,
            deliveryZoneId: delivery?.zoneId ?? null,
            orderNumber: identity.orderNumber,
          },
        },
      },
    },
    include: {
      items: {
        include: {
          modifiers: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      events: {
        orderBy: { createdAt: "asc" },
      },
      payments: true,
    },
  });

  if (settings.machineTestGrantId) {
    await attachMachineTestGrantToOrderInTransaction(
      tx,
      settings.machineTestGrantId,
      order.id,
    );
  }

  return order;
}

async function markCheckoutSessionCreated(
  orderId: string,
  paymentId: string,
  session: Awaited<ReturnType<typeof createHostedCheckoutSession>>,
) {
  return db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        checkoutSessionId: session.checkoutSessionId,
        hostedCheckoutUrl: session.hostedCheckoutUrl,
        sessionExpiresAt: session.sessionExpiresAt,
        rawProviderData: toPrismaJson({
          response: session.rawProviderData,
          request: session.requestPayload,
        }),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.SYSTEM,
        eventType: "CLOVER_CHECKOUT_SESSION_CREATED",
        fromPaymentStatus: OrderPaymentStatus.PENDING,
        toPaymentStatus: OrderPaymentStatus.PENDING,
        message: "Clover Hosted Checkout session created. Payment is pending webhook reconciliation.",
        metadata: {
          paymentId,
          checkoutSessionId: session.checkoutSessionId,
          hostedCheckoutUrl: session.hostedCheckoutUrl,
          sessionExpiresAt: session.sessionExpiresAt?.toISOString() ?? null,
        },
      },
    });
  });
}

function getCheckoutFailureDetails(error: unknown): {
  code: string;
  message: string;
  status: number;
  providerStatus?: number;
  providerResponse?: unknown;
} {
  if (
    error instanceof Error &&
    error.message.startsWith("Clover Hosted Checkout is not configured.")
  ) {
    return {
      code: "CLOVER_CONFIG_ERROR",
      message: error.message,
      status: 503,
    };
  }

  if (error instanceof CloverApiError) {
    return {
      code: "CLOVER_API_ERROR",
      message: "Clover Hosted Checkout could not be created.",
      status: 502,
      providerStatus: error.status,
      providerResponse: error.responseBody,
    };
  }

  return {
    code: "CLOVER_CHECKOUT_ERROR",
    message: "Clover Hosted Checkout could not be created.",
    status: 502,
  };
}

async function markCheckoutSessionFailed(
  orderId: string,
  paymentId: string,
  failure: ReturnType<typeof getCheckoutFailureDetails>,
) {
  await db.$transaction(async (tx) => {
    const applied = await failPendingPaymentInTransaction(tx, orderId, paymentId);
    if (applied) {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
        failureCode: failure.code,
        failureMessage: failure.message,
        rawProviderData: toPrismaJson({
          checkoutCreateFailure: {
            code: failure.code,
            message: failure.message,
            providerStatus: failure.providerStatus ?? null,
            providerResponse: failure.providerResponse ?? null,
          },
        }),
        },
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.SYSTEM,
        eventType: applied
          ? "CLOVER_CHECKOUT_SESSION_FAILED"
          : "CLOVER_CHECKOUT_SESSION_FAILURE_IGNORED",
        fromPaymentStatus: applied ? OrderPaymentStatus.PENDING : null,
        toPaymentStatus: applied ? OrderPaymentStatus.FAILED : null,
        message: applied
          ? failure.message
          : "Ignored checkout-session failure because payment was no longer pending.",
        metadata: {
          paymentId,
          code: failure.code,
          providerStatus: failure.providerStatus ?? null,
          providerResponse: failure.providerResponse ?? null,
        },
      },
    });
  });
}

async function markEcommerceChargeSucceeded({
  orderId,
  paymentId,
  charge,
}: {
  orderId: string;
  paymentId: string;
  charge: Awaited<ReturnType<typeof createCloverEcommerceCharge>>;
}) {
  return db.$transaction(async (tx) => {
    const currentPayment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!currentPayment) {
      throw new Error(`Payment ${paymentId} was not found after Clover charge.`);
    }

    const paidAt = new Date();
    const alreadyPaid =
      currentPayment.status === OrderPaymentStatus.PAID ||
      currentPayment.order.paymentStatus === OrderPaymentStatus.PAID;
    const canPromote =
      currentPayment.order.paymentStatus === OrderPaymentStatus.PENDING ||
      currentPayment.order.paymentStatus === OrderPaymentStatus.FAILED;
    const toPaymentStatus =
      charge.paid && canPromote
        ? OrderPaymentStatus.PAID
        : currentPayment.order.paymentStatus;
    const toFulfillmentStatus =
      charge.paid && currentPayment.order.fulfillmentStatus === OrderFulfillmentStatus.AWAITING_PAYMENT
        ? OrderFulfillmentStatus.AWAITING_ACCEPTANCE
        : currentPayment.order.fulfillmentStatus;
    let paidNow = false;

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        providerPaymentId: charge.providerPaymentId,
        providerOrderId: charge.providerOrderId,
        rawProviderData: toPrismaJson({
          response: redactCloverSource(charge.rawProviderData),
          request: redactCloverSource(charge.requestPayload),
          idempotencyKey: charge.idempotencyKey,
        }),
      },
    });

    if (charge.paid && !alreadyPaid) {
      paidNow = await confirmPaymentInTransaction(tx, orderId, paymentId, paidAt);
      if (paidNow && toFulfillmentStatus !== currentPayment.order.fulfillmentStatus) {
        await tx.order.update({
          where: { id: orderId },
          data: { fulfillmentStatus: toFulfillmentStatus },
        });
      }
    }
    if (toPaymentStatus === OrderPaymentStatus.PAID) {
      await ensureInitialPrintIntentInTransaction(tx, orderId, {
        actorType: OrderActorType.SYSTEM,
        actorLabel: "clover-ecommerce-reconciliation",
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.SYSTEM,
        actorLabel: "Clover",
        eventType: charge.paid ? "CLOVER_ECOMMERCE_CHARGE_PAID" : "CLOVER_ECOMMERCE_CHARGE_CREATED",
        fromPaymentStatus: currentPayment.order.paymentStatus,
        toPaymentStatus,
        fromFulfillmentStatus: currentPayment.order.fulfillmentStatus,
        toFulfillmentStatus,
        message: charge.paid
          ? "Clover Ecommerce charge approved. Order is awaiting admin acceptance."
          : "Clover Ecommerce charge created. Payment is pending reconciliation.",
        metadata: {
          paymentId,
          providerPaymentId: charge.providerPaymentId,
          providerOrderId: charge.providerOrderId,
          providerStatus: charge.status,
          idempotencyKey: charge.idempotencyKey,
        },
      },
    });

    return {
      paymentStatus: toPaymentStatus,
      fulfillmentStatus: toFulfillmentStatus,
      paidNow,
    };
  });
}

async function findExistingPaymentByProviderPaymentId(providerPaymentId: string) {
  return db.payment.findUnique({
    where: { providerPaymentId },
    include: {
      order: {
        include: {
          items: {
            include: { modifiers: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
}

async function findExistingPaymentByIdempotencyKey(idempotencyKey: string) {
  return db.payment.findUnique({
    where: { providerIdempotencyKey: idempotencyKey },
    include: {
      order: {
        include: {
          items: {
            include: { modifiers: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
}

async function markDuplicateIframeOrderFailed({
  orderId,
  paymentId,
  idempotencyKey,
  existingPaymentId,
}: {
  orderId: string;
  paymentId: string;
  idempotencyKey: string;
  existingPaymentId: string;
}) {
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: OrderPaymentStatus.FAILED },
    });

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: OrderPaymentStatus.FAILED,
        failedAt: new Date(),
        failureCode: "DUPLICATE_IDEMPOTENCY_KEY",
        failureMessage: "Duplicate Clover iframe payment request reused an existing charge.",
        rawProviderData: toPrismaJson({
          duplicateIframePayment: {
            idempotencyKey,
            existingPaymentId,
          },
        }),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.SYSTEM,
        actorLabel: "Clover",
        eventType: "CLOVER_IFRAME_DUPLICATE_PAYMENT_REQUEST",
        fromPaymentStatus: OrderPaymentStatus.PENDING,
        toPaymentStatus: OrderPaymentStatus.FAILED,
        message: "Duplicate Clover iframe payment request reused an existing charge.",
        metadata: {
          paymentId,
          existingPaymentId,
          idempotencyKey,
        },
      },
    });
  });
}

function iframeCheckoutResponse({
  order,
  payment,
  paymentStatus,
  fulfillmentStatus,
  providerPaymentId,
  providerOrderId,
  duplicate = false,
}: {
  order: ExistingPaymentWithOrder["order"];
  payment: Pick<
    ExistingPaymentWithOrder,
    "id" | "providerIdempotencyKey" | "providerPaymentId" | "providerOrderId"
  >;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  duplicate?: boolean;
}) {
  return NextResponse.json(
    {
      ok: true,
      data: {
        order: {
          id: order.id,
          publicCode: order.orderNumber,
          orderNumber: order.orderNumber,
          trackingUrl: buildTrackingUrl(order.trackingToken),
          serviceType: order.serviceType,
          paymentStatus,
          fulfillmentStatus,
          totalCents: order.totalCents,
          currency: order.currency,
          items: order.items,
          payments: [
            {
              id: payment.id,
              provider: "CLOVER",
        status: paymentStatus,
        amountCents: order.totalCents,
        currency: order.currency,
        providerIdempotencyKey: payment.providerIdempotencyKey,
        providerPaymentId,
        providerOrderId,
      },
          ],
        },
        payment: {
          provider: "CLOVER",
          id: payment.id,
          providerPaymentId,
          providerOrderId,
          status: paymentStatus,
        },
        trackingUrl: buildTrackingUrl(order.trackingToken),
        ...(duplicate ? { duplicate: true } : {}),
      },
    },
    { status: 201 },
  );
}

async function markEcommerceChargeFailed(
  orderId: string,
  paymentId: string,
  failure: ReturnType<typeof getEcommerceFailureDetails>,
  idempotencyKey: string | null,
) {
  const providerResponse = failure.providerResponse
    ? redactCloverSource(failure.providerResponse)
    : null;

  await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (
      payment?.status === OrderPaymentStatus.PAID ||
      payment?.order.paymentStatus === OrderPaymentStatus.PAID
    ) {
      await tx.orderEvent.create({
        data: {
          orderId,
          actorType: OrderActorType.SYSTEM,
          actorLabel: "Clover",
          eventType: "CLOVER_ECOMMERCE_FAILURE_IGNORED_AFTER_PAID",
          fromPaymentStatus: payment.order.paymentStatus,
          toPaymentStatus: payment.order.paymentStatus,
          message: "Ignored a Clover Ecommerce failure because payment was already reconciled as paid.",
          metadata: {
            paymentId,
            code: failure.code,
            providerStatus: failure.providerStatus ?? null,
            providerResponse,
            idempotencyKey,
          },
        },
      });
      return;
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: OrderPaymentStatus.FAILED,
      },
    });

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: OrderPaymentStatus.FAILED,
        failedAt: new Date(),
        failureCode: failure.code,
        failureMessage: failure.message,
        rawProviderData: toPrismaJson({
          ecommerceChargeFailure: {
            code: failure.code,
            message: failure.message,
            providerStatus: failure.providerStatus ?? null,
            providerResponse,
            idempotencyKey,
          },
        }),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.SYSTEM,
        actorLabel: "Clover",
        eventType: "CLOVER_ECOMMERCE_CHARGE_FAILED",
        fromPaymentStatus: OrderPaymentStatus.PENDING,
        toPaymentStatus: OrderPaymentStatus.FAILED,
        message: failure.message,
        metadata: {
          paymentId,
          code: failure.code,
          providerStatus: failure.providerStatus ?? null,
          providerResponse,
          idempotencyKey,
        },
      },
    });
  });
}

async function markEcommerceChargeUnresolved(
  orderId: string,
  paymentId: string,
  failure: ReturnType<typeof getEcommerceFailureDetails>,
  idempotencyKey: string,
) {
  const providerResponse = failure.providerResponse
    ? redactCloverSource(failure.providerResponse)
    : null;

  await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new Error(`Payment ${paymentId} was not found after unresolved Clover charge.`);
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        failureCode: failure.code,
        failureMessage: failure.message,
        rawProviderData: toPrismaJson({
          previous: payment.rawProviderData ?? null,
          ecommerceChargeUnresolved: {
            code: failure.code,
            message: failure.message,
            providerStatus: failure.providerStatus ?? null,
            providerResponse,
            idempotencyKey,
          },
        }),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.SYSTEM,
        actorLabel: "Clover",
        eventType: "CLOVER_ECOMMERCE_CHARGE_UNRESOLVED",
        fromPaymentStatus: payment.order.paymentStatus,
        toPaymentStatus: payment.order.paymentStatus,
        fromFulfillmentStatus: payment.order.fulfillmentStatus,
        toFulfillmentStatus: payment.order.fulfillmentStatus,
        message: "Clover Ecommerce charge result is unresolved. Webhook reconciliation remains pending.",
        metadata: {
          paymentId,
          code: failure.code,
          providerStatus: failure.providerStatus ?? null,
          providerResponse,
          idempotencyKey,
        },
      },
    });
  });
}

export async function POST(request: NextRequest) {
  const rateLimit = await consumeRateLimit(db, PUBLIC_ENDPOINT_RATE_LIMITS.checkoutCreateClient, getPublicClientRateLimitKey(request));
  if (!rateLimit.ok) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many checkout attempts." } }, { status: 429, headers: { "Retry-After": rateLimit.retryAfterSeconds.toString() } });
  }
  let payload: CheckoutCreateInput;

  try {
    payload = checkoutCreateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid checkout request.",
        error.issues,
      );
    }

    return errorResponse(400, "INVALID_JSON", "Invalid checkout request.");
  }

  if (payload.serviceType !== OrderServiceType.DELIVERY) {
    return errorResponse(400, "DELIVERY_ONLY", "Buffet Pin Direct accepts delivery orders only.");
  }

  const checkoutMode = getCloverCheckoutMode();
  const machineTestGrantToken =
    request.cookies.get(MACHINE_TEST_GRANT_COOKIE)?.value ?? null;

  if (checkoutMode !== "iframe") {
    return errorResponse(503, "MAPPED_CHECKOUT_REQUIRED", "Delivery ordering requires Clover iframe mapped-order checkout. Hosted Checkout is not a safe fallback for kitchen printing.");
  }

  if (checkoutMode === "iframe") {
    if (!payload.cloverPayment?.source) {
      return errorResponse(
        400,
        "CLOVER_SOURCE_REQUIRED",
        "Clover iframe checkout requires a Clover source token.",
      );
    }

    if (!payload.cloverPayment.idempotencyKey) {
      return errorResponse(
        400,
        "CLOVER_IDEMPOTENCY_KEY_REQUIRED",
        "Clover iframe checkout requires an idempotency key.",
      );
    }

    const fingerprint = checkoutRequestFingerprint(payload);
    const existingPayment = await findExistingPaymentByIdempotencyKey(
      payload.cloverPayment.idempotencyKey,
    );

    if (existingPayment) {
      if (!checkoutIdempotencyMatches(existingPayment, fingerprint)) {
        return errorResponse(
          409,
          "IDEMPOTENCY_CONFLICT",
          "The Clover idempotency key was already used for a different checkout request.",
        );
      }
      return iframeCheckoutResponse({
        order: existingPayment.order,
        payment: existingPayment,
        paymentStatus: existingPayment.status,
        fulfillmentStatus: existingPayment.order.fulfillmentStatus,
        providerPaymentId: existingPayment.providerPaymentId,
        providerOrderId: existingPayment.providerOrderId,
        duplicate: true,
      });
    }
  }

  for (let attempt = 1; attempt <= MAX_PUBLIC_CODE_ATTEMPTS; attempt += 1) {
    try {
      const order = await db.$transaction(
        (tx) =>
          createPendingOrder(
            tx,
            payload,
            generatePublicOrderCode(),
            machineTestGrantToken,
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      const payment = order.payments[0];

      if (!payment) {
        throw new Error(`Order ${order.id} was created without a pending payment.`);
      }

      await dispatchAggregateJobs("Order", order.id);

      if (checkoutMode === "iframe") {
        const idempotencyKey = payload.cloverPayment!.idempotencyKey!;

        try {
          const charge = await createCloverEcommerceCharge({
            order,
            payment,
            source: payload.cloverPayment!.source,
            idempotencyKey,
            forwardedFor: getForwardedFor(request),
            providerOrderId: (await ensureCloverExternalOrder(order.id)).providerOrderId!,
          });

          if (charge.failed) {
            const failure = {
              code: "CLOVER_PAYMENT_DECLINED",
              message: "Clover declined this payment.",
              status: 402,
              terminal: true,
              providerStatus: 200,
              providerResponse: charge.rawProviderData,
            };

            await markEcommerceChargeFailed(order.id, payment.id, failure, idempotencyKey);

            return errorResponse(failure.status, failure.code, failure.message, {
              order: {
                id: order.id,
                publicCode: order.orderNumber,
                orderNumber: order.orderNumber,
              },
              payment: {
                id: payment.id,
                status: OrderPaymentStatus.FAILED,
              },
            });
          }

          const existingPayment = await findExistingPaymentByProviderPaymentId(
            charge.providerPaymentId,
          );

          if (existingPayment && existingPayment.id !== payment.id) {
            await markDuplicateIframeOrderFailed({
              orderId: order.id,
              paymentId: payment.id,
              idempotencyKey,
              existingPaymentId: existingPayment.id,
            });

            return iframeCheckoutResponse({
              order: existingPayment.order,
              payment: existingPayment,
              paymentStatus: existingPayment.status,
              fulfillmentStatus: existingPayment.order.fulfillmentStatus,
              providerPaymentId: existingPayment.providerPaymentId,
              providerOrderId: existingPayment.providerOrderId,
              duplicate: true,
            });
          }

          const updatedState = await markEcommerceChargeSucceeded({
            orderId: order.id,
            paymentId: payment.id,
            charge,
          });

          await dispatchAggregateJobs("Order", order.id);

          if (updatedState.paidNow) {
            await notifyPaymentConfirmed(order.id);
          }
          if (updatedState.paymentStatus === OrderPaymentStatus.PAID) {
            await submitInitialPrintForOrder(order.id).catch((printError) => {
              console.error("Initial print submission remains pending/exception", {
                orderId: order.id,
                printError,
              });
            });
          }

          return iframeCheckoutResponse({
            order,
            payment,
            paymentStatus: updatedState.paymentStatus,
            fulfillmentStatus: updatedState.fulfillmentStatus,
            providerPaymentId: charge.providerPaymentId,
            providerOrderId: charge.providerOrderId,
          });
        } catch (error) {
          const failure = getEcommerceFailureDetails(error);

          if (!failure.terminal) {
            await markEcommerceChargeUnresolved(order.id, payment.id, failure, idempotencyKey);
            console.error("Clover Ecommerce charge result is unresolved", {
              orderId: order.id,
              paymentId: payment.id,
              error,
            });

            return iframeCheckoutResponse({
              order,
              payment,
              paymentStatus: OrderPaymentStatus.PENDING,
              fulfillmentStatus: OrderFulfillmentStatus.AWAITING_PAYMENT,
              providerPaymentId: null,
              providerOrderId: null,
            });
          }

          await markEcommerceChargeFailed(order.id, payment.id, failure, idempotencyKey);
          console.error("Unable to complete Clover Ecommerce charge", {
            orderId: order.id,
            paymentId: payment.id,
            error,
          });

          return errorResponse(failure.status, failure.code, failure.message, {
            order: {
              id: order.id,
              publicCode: order.orderNumber,
              orderNumber: order.orderNumber,
            },
            payment: {
              id: payment.id,
              status: OrderPaymentStatus.FAILED,
            },
          });
        }
      }

      let checkoutSession: Awaited<ReturnType<typeof createHostedCheckoutSession>>;

      try {
        checkoutSession = await createHostedCheckoutSession({ order, payment });
        await markCheckoutSessionCreated(order.id, payment.id, checkoutSession);
      } catch (error) {
        const failure = getCheckoutFailureDetails(error);

        await markCheckoutSessionFailed(order.id, payment.id, failure);
        console.error("Unable to create Clover checkout session", {
          orderId: order.id,
          paymentId: payment.id,
          error,
        });

        return errorResponse(failure.status, failure.code, failure.message, {
          order: {
            id: order.id,
            publicCode: order.orderNumber,
            orderNumber: order.orderNumber,
          },
          payment: {
            id: payment.id,
            status: OrderPaymentStatus.FAILED,
          },
        });
      }

      return NextResponse.json(
        {
          ok: true,
          data: {
            order: {
              id: order.id,
              publicCode: order.orderNumber,
              orderNumber: order.orderNumber,
              trackingUrl: buildTrackingUrl(order.trackingToken),
              serviceType: order.serviceType,
              paymentStatus: order.paymentStatus,
              fulfillmentStatus: order.fulfillmentStatus,
              totalCents: order.totalCents,
              currency: order.currency,
              items: order.items,
              payments: [
                {
                  ...payment,
                  checkoutSessionId: checkoutSession.checkoutSessionId,
                  hostedCheckoutUrl: checkoutSession.hostedCheckoutUrl,
                  sessionExpiresAt: checkoutSession.sessionExpiresAt,
                },
              ],
            },
            payment: {
              provider: "CLOVER",
              id: payment.id,
              checkoutSessionId: checkoutSession.checkoutSessionId,
              checkoutUrl: checkoutSession.hostedCheckoutUrl,
              sessionExpiresAt: checkoutSession.sessionExpiresAt,
            },
            trackingUrl: buildTrackingUrl(order.trackingToken),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof OrderPricingError) {
        const status =
          error.code === "ITEM_NOT_FOUND"
            ? 404
            : error.code.includes("UNAVAILABLE") ||
                error.code === "ONLINE_ORDERING_DISABLED" ||
                error.code === "PICKUP_DISABLED" ||
                error.code === "DELIVERY_DISABLED"
              ? 409
              : 400;

        return errorResponse(status, error.code, error.message, error.details);
      }

      if (error instanceof DeliveryValidationError) {
        const status =
          error.code === "DELIVERY_OUT_OF_RANGE" ||
          error.code === "DELIVERY_DISABLED"
            ? 409
            : 400;

        return errorResponse(status, error.code, error.message, error.details);
      }

      if (
        checkoutMode === "iframe" &&
        payload.cloverPayment?.idempotencyKey &&
        isUniqueConstraintError(error)
      ) {
        const existingPayment = await findExistingPaymentByIdempotencyKey(
          payload.cloverPayment.idempotencyKey,
        );

        if (existingPayment) {
          if (!checkoutIdempotencyMatches(existingPayment, checkoutRequestFingerprint(payload))) {
            return errorResponse(
              409,
              "IDEMPOTENCY_CONFLICT",
              "The Clover idempotency key was already used for a different checkout request.",
            );
          }
          return iframeCheckoutResponse({
            order: existingPayment.order,
            payment: existingPayment,
            paymentStatus: existingPayment.status,
            fulfillmentStatus: existingPayment.order.fulfillmentStatus,
            providerPaymentId: existingPayment.providerPaymentId,
            providerOrderId: existingPayment.providerOrderId,
            duplicate: true,
          });
        }
      }

      if (
        (isUniqueConstraintError(error) || isRetryableTransactionError(error)) &&
        attempt < MAX_PUBLIC_CODE_ATTEMPTS
      ) {
        continue;
      }

      if (isUniqueConstraintError(error)) {
        return errorResponse(
          409,
          "ORDER_CODE_COLLISION",
          "Unable to create a unique order code.",
        );
      }

      if (isRetryableTransactionError(error)) {
        return errorResponse(
          409,
          "ORDER_CREATE_CONFLICT",
          "Order data changed while creating checkout.",
        );
      }

      console.error(error);
      return errorResponse(500, "INTERNAL_ERROR", "Unable to create checkout.");
    }
  }

  return errorResponse(500, "INTERNAL_ERROR", "Unable to create checkout.");
}
