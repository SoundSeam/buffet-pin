-- CreateEnum
CREATE TYPE "OrderServiceType" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "OrderRefundStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'PENDING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderFulfillmentStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'AWAITING_ACCEPTANCE', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'DRIVER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVING_SOON', 'DELIVERED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('CLOVER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "OrderActorType" AS ENUM ('CUSTOMER', 'ADMIN', 'DRIVER', 'SYSTEM', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "DriverAssignmentStatus" AS ENUM ('ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVING_SOON', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minSelections" INTEGER NOT NULL DEFAULT 0,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierOption" (
    "id" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemModifierGroup" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "language" "ReservationLanguage" NOT NULL DEFAULT 'FR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "deliveryInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "serviceType" "OrderServiceType" NOT NULL,
    "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "refundStatus" "OrderRefundStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "fulfillmentStatus" "OrderFulfillmentStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "customerAddressId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "deliveryAddressLine1" TEXT,
    "deliveryAddressLine2" TEXT,
    "deliveryCity" TEXT,
    "deliveryProvince" TEXT,
    "deliveryPostalCode" TEXT,
    "deliveryCountry" TEXT,
    "deliveryLatitude" DOUBLE PRECISION,
    "deliveryLongitude" DOUBLE PRECISION,
    "deliveryDistanceKm" DOUBLE PRECISION,
    "deliveryInstructions" TEXT,
    "isAsap" BOOLEAN NOT NULL DEFAULT true,
    "requestedFor" TIMESTAMP(3),
    "estimatedReadyStartAt" TIMESTAMP(3),
    "estimatedReadyEndAt" TIMESTAMP(3),
    "estimatedDeliveryStartAt" TIMESTAMP(3),
    "estimatedDeliveryEndAt" TIMESTAMP(3),
    "itemsSubtotalCents" INTEGER NOT NULL,
    "taxableSubtotalCents" INTEGER NOT NULL,
    "gstCents" INTEGER NOT NULL DEFAULT 0,
    "qstCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL,
    "tipCents" INTEGER NOT NULL DEFAULT 0,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "rejectionReason" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "menuItemNameSnapshot" TEXT NOT NULL,
    "menuItemDescriptionSnapshot" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "modifiersTotalCents" INTEGER NOT NULL DEFAULT 0,
    "lineSubtotalCents" INTEGER NOT NULL,
    "specialInstructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemModifier" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT,
    "modifierOptionId" TEXT,
    "modifierGroupNameSnapshot" TEXT NOT NULL,
    "modifierOptionNameSnapshot" TEXT NOT NULL,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "refundStatus" "OrderRefundStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "amountCents" INTEGER NOT NULL,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "checkoutSessionId" TEXT,
    "providerPaymentId" TEXT,
    "providerOrderId" TEXT,
    "hostedCheckoutUrl" TEXT,
    "sessionExpiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundRequestedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "rawProviderData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "checkoutSessionId" TEXT,
    "providerPaymentId" TEXT,
    "paymentId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorType" "OrderActorType" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "eventType" TEXT NOT NULL,
    "fromPaymentStatus" "OrderPaymentStatus",
    "toPaymentStatus" "OrderPaymentStatus",
    "fromFulfillmentStatus" "OrderFulfillmentStatus",
    "toFulfillmentStatus" "OrderFulfillmentStatus",
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "recipient" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "centerLatitude" DOUBLE PRECISION NOT NULL,
    "centerLongitude" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "minimumOrderCents" INTEGER NOT NULL DEFAULT 0,
    "freeDeliveryThresholdCents" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "DriverAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrderSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "onlineOrderingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduledOrdersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "asapOnly" BOOLEAN NOT NULL DEFAULT true,
    "restaurantLatitude" DOUBLE PRECISION,
    "restaurantLongitude" DOUBLE PRECISION,
    "deliveryRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "minimumDeliveryOrderCents" INTEGER NOT NULL DEFAULT 0,
    "freeDeliveryThresholdCents" INTEGER,
    "defaultPickupPrepMinutes" INTEGER NOT NULL DEFAULT 25,
    "defaultDeliveryPrepMinutes" INTEGER NOT NULL DEFAULT 45,
    "busyModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "busyModeExtraMinutes" INTEGER NOT NULL DEFAULT 0,
    "maxActiveOrders" INTEGER,
    "orderCutoffMinutesBeforeClose" INTEGER,
    "gstRatePpm" INTEGER NOT NULL DEFAULT 50000,
    "qstRatePpm" INTEGER NOT NULL DEFAULT 99750,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantOrderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuCategory_isActive_sortOrder_idx" ON "MenuCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_sortOrder_idx" ON "MenuItem"("categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItem_isAvailable_isActive_idx" ON "MenuItem"("isAvailable", "isActive");

-- CreateIndex
CREATE INDEX "ModifierGroup_isActive_sortOrder_idx" ON "ModifierGroup"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ModifierOption_modifierGroupId_sortOrder_idx" ON "ModifierOption"("modifierGroupId", "sortOrder");

-- CreateIndex
CREATE INDEX "ModifierOption_isAvailable_isActive_idx" ON "ModifierOption"("isAvailable", "isActive");

-- CreateIndex
CREATE INDEX "MenuItemModifierGroup_menuItemId_sortOrder_idx" ON "MenuItemModifierGroup"("menuItemId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemModifierGroup_menuItemId_modifierGroupId_key" ON "MenuItemModifierGroup"("menuItemId", "modifierGroupId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- CreateIndex
CREATE INDEX "CustomerAddress_postalCode_idx" ON "CustomerAddress"("postalCode");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicCode_key" ON "Order"("publicCode");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_refundStatus_fulfillmentStatus_serviceT_idx" ON "Order"("paymentStatus", "refundStatus", "fulfillmentStatus", "serviceType", "createdAt");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_customerAddressId_idx" ON "Order"("customerAddressId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_orderItemId_idx" ON "OrderItemModifier"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_modifierOptionId_idx" ON "OrderItemModifier"("modifierOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_checkoutSessionId_key" ON "Payment"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_provider_status_idx" ON "Payment"("provider", "status");

-- CreateIndex
CREATE INDEX "Payment_refundStatus_idx" ON "Payment"("refundStatus");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_checkoutSessionId_idx" ON "PaymentWebhookEvent"("checkoutSessionId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_providerPaymentId_idx" ON "PaymentWebhookEvent"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_paymentId_idx" ON "PaymentWebhookEvent"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_eventType_idx" ON "OrderEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_providerMessageId_key" ON "Notification"("providerMessageId");

-- CreateIndex
CREATE INDEX "Notification_orderId_idx" ON "Notification"("orderId");

-- CreateIndex
CREATE INDEX "Notification_customerId_idx" ON "Notification"("customerId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_recipient_idx" ON "Notification"("recipient");

-- CreateIndex
CREATE INDEX "DeliveryZone_isActive_sortOrder_idx" ON "DeliveryZone"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_supabaseUserId_key" ON "Driver"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");

-- CreateIndex
CREATE INDEX "Driver_isActive_idx" ON "Driver"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DriverAssignment_orderId_key" ON "DriverAssignment"("orderId");

-- CreateIndex
CREATE INDEX "DriverAssignment_driverId_status_idx" ON "DriverAssignment"("driverId", "status");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_modifierOptionId_fkey" FOREIGN KEY ("modifierOptionId") REFERENCES "ModifierOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
