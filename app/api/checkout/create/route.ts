import {
  OrderActorType,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  PaymentProvider,
  OrderServiceType,
  Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { CloverApiError } from "@/lib/clover/client";
import { createHostedCheckoutSession } from "@/lib/clover/checkout";
import { db } from "@/lib/db";
import { generatePublicOrderCode } from "@/lib/orders/codes";
import { DeliveryValidationError } from "@/lib/orders/delivery";
import { OrderPricingError, priceCart } from "@/lib/orders/pricing";
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
) {
  const pricedCart = await priceCart(payload, tx);
  const settings = await tx.restaurantOrderSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  if (!settings.onlineOrderingEnabled) {
    throw new OrderPricingError(
      "ONLINE_ORDERING_DISABLED",
      "Online ordering is currently unavailable.",
    );
  }

  const customer = await upsertCustomer(tx, payload.customer);
  const customerAddress = await upsertCustomerAddress(tx, customer.id, pricedCart);
  const delivery = pricedCart.delivery;

  return tx.order.create({
    data: {
      publicCode,
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
      deliveryInstructions: delivery?.address.deliveryInstructions,
      isAsap: true,
      requestedFor: null,
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
          checkoutCreateFailure: {
            code: failure.code,
            message: failure.message,
            providerStatus: failure.providerStatus ?? null,
            providerResponse: failure.providerResponse ?? null,
          },
        }),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorType: OrderActorType.SYSTEM,
        eventType: "CLOVER_CHECKOUT_SESSION_FAILED",
        fromPaymentStatus: OrderPaymentStatus.PENDING,
        toPaymentStatus: OrderPaymentStatus.FAILED,
        message: failure.message,
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

export async function POST(request: Request) {
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

  for (let attempt = 1; attempt <= MAX_PUBLIC_CODE_ATTEMPTS; attempt += 1) {
    try {
      const order = await db.$transaction(
        (tx) => createPendingOrder(tx, payload, generatePublicOrderCode()),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      const payment = order.payments[0];

      if (!payment) {
        throw new Error(`Order ${order.id} was created without a pending payment.`);
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
            publicCode: order.publicCode,
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
              publicCode: order.publicCode,
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
