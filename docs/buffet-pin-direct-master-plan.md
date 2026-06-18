# Buffet Pin Direct Master Plan

This document is the shared implementation brief for Buffet Pin Direct. Every implementation thread should read this before touching code. The goal is not only to add features, but to keep the system coherent: orders, money, fulfillment, customer status, notifications, and driver work must all agree on one source of truth.

## First Principles Goal

Buffet Pin Direct exists to let Buffet Pin take direct pickup and delivery orders, collect online payment, fulfill those orders internally, and give customers a polished status experience without pretending to offer live tracking.

The system must optimize for these properties:

- The database is the source of truth.
- Server-side price calculation is authoritative.
- Clover redirect pages are only customer UX.
- Clover webhook reconciliation is the proof of payment.
- Payment state and fulfillment state are separate.
- Fulfillment status changes come from real staff or driver actions.
- Customers see estimated windows and real timeline events, not fake countdowns or GPS.
- Admin/staff need a clear operational queue more than clever abstractions.
- Drivers need a narrow assigned-order workflow.
- Rejections after payment trigger programmatic refunds and visible refund state.
- Every important state change is auditable through events and notifications.

## Known Decisions

- App: keep Buffet Pin Direct in the existing Next.js app.
- Router: App Router.
- Database: Prisma/Postgres.
- Admin auth: existing Supabase auth and `ADMIN_EMAILS` allow-list.
- Driver auth: Supabase driver accounts.
- Payment provider: Clover Hosted Checkout.
- Payment source of truth: Clover webhook, not browser redirect.
- Delivery eligibility: distance-based.
- Refunds: programmatic automatic refunds on rejected paid orders, with clean admin/customer marking.
- Menu MVP: mock items, no images required, but schema/UI must support images later.
- Tax: apply full Quebec tax to item subtotal.
- Tips: collected inside Buffet Pin checkout before Clover.
- Orders: ASAP only for MVP, with planned support for scheduled orders.
- Realtime: polling first, no websockets for MVP.

## Existing Repo Facts

Current app patterns to preserve:

- Next.js `15.1.0`, React `19`, TypeScript strict.
- Prisma schema: `prisma/schema.prisma`.
- DB client: `lib/db.ts`.
- Env validation: `lib/env.ts`.
- Admin auth: `lib/supabase/auth.ts`.
- Public/admin API style: App Router route handlers under `app/api`.
- Public validation: Zod schemas in `lib/validation.ts`, plus module-local schemas.
- Admin UI style: client components in `components/admin`.
- Existing admin dashboard polls route handlers, with reservation polling currently set at 15 seconds.
- SMS: Twilio wrapper in `lib/sms.ts`; templates in `lib/sms-templates.ts`.
- Vercel cron: `vercel.json`.

Important current files:

- `app/api/reservations/route.ts`: public reservation create flow.
- `app/api/reservations/availability/route.ts`: public availability validation.
- `app/api/admin/reservations/route.ts`: admin reservation list/create.
- `app/api/admin/reservations/[id]/route.ts`: admin reservation updates.
- `components/admin/admin-reservations-dashboard.tsx`: polling admin dashboard pattern.
- `app/api/cron/send-reminders/route.ts`: cron authorization and Twilio reminder flow.
- `app/api/twilio/message-status/route.ts`: Twilio signature validation.
- `prisma/schema.prisma`: existing models are `Reservation`, `Settings`, `SlotCapacitySetting`, `ClosureDate`, and `PublicApiRateLimit`.

Current risks to keep in mind:

- `/menu` currently returns 404 even though menu components/translations exist.
- Admin reservation SMS recipient is hard-coded in `lib/sms.ts`.
- Current admin settings UI edits reservation slot capacities only; order settings need their own surface.
- There is no established test framework in scripts, so implementation threads should add focused tests where practical or at least verify with build/type checks.

## Architecture Overview

Buffet Pin Direct should be added as a new ordering module beside reservations:

```txt
Public customer ordering
-> server-side menu/pricing validation
-> unpaid order stored in DB
-> Clover Hosted Checkout session
-> Clover redirect for UX only
-> Clover webhook reconciles payment
-> paid order enters admin queue
-> staff accept/reject and fulfill
-> customer status page polls real order state
-> delivery orders can be assigned to Supabase-authenticated drivers
-> notifications are logged and sent on important state changes
```

## Route Map

Public customer routes:

```txt
/order
/order/checkout
/order/payment/success
/order/payment/failure
/order/[publicCode]
```

Admin routes:

```txt
/admin/orders
/admin/orders/[id]
/admin/menu
/admin/delivery
/admin/drivers
/admin/settings/orders
```

Driver routes:

```txt
/driver
/driver/orders
/driver/orders/[id]
```

API routes:

```txt
/api/menu
/api/checkout/create
/api/orders/[publicCode]
/api/webhooks/clover
/api/webhooks/twilio
/api/admin/orders
/api/admin/orders/[id]
/api/admin/orders/[id]/accept
/api/admin/orders/[id]/reject
/api/admin/orders/[id]/status
/api/admin/orders/[id]/assign-driver
/api/admin/menu
/api/admin/menu/categories
/api/admin/menu/items
/api/admin/menu/modifier-groups
/api/admin/delivery/validate
/api/admin/drivers
/api/driver/orders
/api/driver/orders/[id]
/api/driver/orders/[id]/status
```

The exact shape can be consolidated during implementation, but the public/admin/driver boundaries should remain clear.

## Data Model Specification

The schema should be additive. Do not rename, drop, or repurpose existing reservation tables. Reservation and ordering are separate domains.

### Enums

Recommended Prisma enums:

```prisma
enum OrderServiceType {
  PICKUP
  DELIVERY
}

enum OrderPaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum OrderRefundStatus {
  NOT_REQUIRED
  REQUIRED
  PENDING
  SUCCEEDED
  PARTIAL
  FAILED
}

enum OrderFulfillmentStatus {
  DRAFT
  AWAITING_PAYMENT
  AWAITING_ACCEPTANCE
  ACCEPTED
  PREPARING
  READY_FOR_PICKUP
  DRIVER_ASSIGNED
  PICKED_UP
  ON_THE_WAY
  ARRIVING_SOON
  DELIVERED
  REJECTED
  CANCELLED
}

enum PaymentProvider {
  CLOVER
}

enum NotificationChannel {
  SMS
  EMAIL
}

enum NotificationStatus {
  PENDING
  SENT
  DELIVERED
  FAILED
  SKIPPED
}

enum OrderActorType {
  CUSTOMER
  ADMIN
  DRIVER
  SYSTEM
  WEBHOOK
}

enum DriverAssignmentStatus {
  ASSIGNED
  PICKED_UP
  ON_THE_WAY
  ARRIVING_SOON
  DELIVERED
  CANCELLED
}
```

### Menu Models

```prisma
model MenuCategory {
  id          String     @id @default(cuid())
  name        String
  description String?
  sortOrder   Int        @default(0)
  isActive    Boolean    @default(true)
  items       MenuItem[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([isActive, sortOrder])
}

model MenuItem {
  id          String                  @id @default(cuid())
  categoryId  String
  category    MenuCategory            @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  name        String
  description String?
  priceCents  Int
  imageUrl    String?
  sortOrder   Int                     @default(0)
  isAvailable Boolean                 @default(true)
  isActive    Boolean                 @default(true)
  modifierGroups MenuItemModifierGroup[]
  orderItems  OrderItem[]
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  @@index([categoryId, sortOrder])
  @@index([isAvailable, isActive])
}

model ModifierGroup {
  id            String                  @id @default(cuid())
  name          String
  description   String?
  minSelections Int                     @default(0)
  maxSelections Int                     @default(1)
  isRequired    Boolean                 @default(false)
  sortOrder     Int                     @default(0)
  isActive      Boolean                 @default(true)
  options       ModifierOption[]
  menuItems     MenuItemModifierGroup[]
  createdAt     DateTime                @default(now())
  updatedAt     DateTime                @updatedAt

  @@index([isActive, sortOrder])
}

model ModifierOption {
  id              String          @id @default(cuid())
  modifierGroupId String
  modifierGroup   ModifierGroup   @relation(fields: [modifierGroupId], references: [id], onDelete: Restrict)
  name            String
  priceDeltaCents Int             @default(0)
  sortOrder       Int             @default(0)
  isAvailable     Boolean         @default(true)
  isActive        Boolean         @default(true)
  orderModifiers  OrderItemModifier[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([modifierGroupId, sortOrder])
  @@index([isAvailable, isActive])
}

model MenuItemModifierGroup {
  id              String        @id @default(cuid())
  menuItemId      String
  menuItem        MenuItem      @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  modifierGroupId String
  modifierGroup   ModifierGroup @relation(fields: [modifierGroupId], references: [id], onDelete: Restrict)
  sortOrder       Int           @default(0)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([menuItemId, modifierGroupId])
  @@index([menuItemId, sortOrder])
}
```

### Customer Models

```prisma
model Customer {
  id        String              @id @default(cuid())
  name      String
  phone     String
  email     String?
  language  ReservationLanguage @default(FR)
  addresses CustomerAddress[]
  orders    Order[]
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt

  @@index([phone])
  @@index([email])
}

model CustomerAddress {
  id                   String     @id @default(cuid())
  customerId           String
  customer             Customer   @relation(fields: [customerId], references: [id], onDelete: Cascade)
  label                String?
  addressLine1         String
  addressLine2         String?
  city                 String
  province             String
  postalCode           String
  country              String     @default("CA")
  latitude             Float?
  longitude            Float?
  deliveryInstructions String?
  orders               Order[]
  createdAt            DateTime   @default(now())
  updatedAt            DateTime   @updatedAt

  @@index([customerId])
  @@index([postalCode])
}
```

### Order Models

```prisma
model Order {
  id                    String                 @id @default(cuid())
  publicCode            String                 @unique
  serviceType           OrderServiceType
  paymentStatus         OrderPaymentStatus     @default(PENDING)
  refundStatus          OrderRefundStatus      @default(NOT_REQUIRED)
  fulfillmentStatus     OrderFulfillmentStatus @default(DRAFT)

  customerId            String
  customer              Customer               @relation(fields: [customerId], references: [id], onDelete: Restrict)
  customerAddressId     String?
  customerAddress       CustomerAddress?       @relation(fields: [customerAddressId], references: [id], onDelete: SetNull)

  customerName          String
  customerPhone         String
  customerEmail         String?

  deliveryAddressLine1  String?
  deliveryAddressLine2  String?
  deliveryCity          String?
  deliveryProvince      String?
  deliveryPostalCode    String?
  deliveryCountry       String?
  deliveryLatitude      Float?
  deliveryLongitude     Float?
  deliveryDistanceKm    Float?
  deliveryInstructions  String?

  isAsap                Boolean                @default(true)
  requestedFor          DateTime?
  estimatedReadyStartAt DateTime?
  estimatedReadyEndAt   DateTime?
  estimatedDeliveryStartAt DateTime?
  estimatedDeliveryEndAt   DateTime?

  itemsSubtotalCents    Int
  taxableSubtotalCents  Int
  gstCents              Int                    @default(0)
  qstCents              Int                    @default(0)
  taxCents              Int
  tipCents              Int                    @default(0)
  deliveryFeeCents      Int                    @default(0)
  discountCents         Int                    @default(0)
  totalCents            Int
  currency              String                 @default("CAD")

  customerNotes         String?
  internalNotes         String?
  rejectionReason       String?

  acceptedAt            DateTime?
  rejectedAt            DateTime?
  cancelledAt           DateTime?
  completedAt           DateTime?
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  items                 OrderItem[]
  payments              Payment[]
  events                OrderEvent[]
  notifications         Notification[]
  driverAssignment      DriverAssignment?

  @@index([paymentStatus])
  @@index([refundStatus])
  @@index([fulfillmentStatus])
  @@index([serviceType])
  @@index([createdAt])
}

model OrderItem {
  id                         String              @id @default(cuid())
  orderId                    String
  order                      Order               @relation(fields: [orderId], references: [id], onDelete: Cascade)
  menuItemId                 String?
  menuItem                   MenuItem?           @relation(fields: [menuItemId], references: [id], onDelete: SetNull)
  menuItemNameSnapshot       String
  menuItemDescriptionSnapshot String?
  quantity                   Int
  unitPriceCents             Int
  modifiersTotalCents        Int                 @default(0)
  lineSubtotalCents          Int
  specialInstructions        String?
  sortOrder                  Int                 @default(0)
  modifiers                  OrderItemModifier[]
  createdAt                  DateTime            @default(now())
  updatedAt                  DateTime            @updatedAt

  @@index([orderId])
  @@index([menuItemId])
}

model OrderItemModifier {
  id                         String          @id @default(cuid())
  orderItemId                String
  orderItem                  OrderItem       @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  modifierGroupId            String?
  modifierOptionId           String?
  modifierOption             ModifierOption? @relation(fields: [modifierOptionId], references: [id], onDelete: SetNull)
  modifierGroupNameSnapshot  String
  modifierOptionNameSnapshot String
  priceDeltaCents            Int             @default(0)
  quantity                   Int             @default(1)
  createdAt                  DateTime        @default(now())

  @@index([orderItemId])
  @@index([modifierOptionId])
}
```

### Payment and Webhook Models

```prisma
model Payment {
  id                    String             @id @default(cuid())
  orderId               String
  order                 Order              @relation(fields: [orderId], references: [id], onDelete: Cascade)
  provider              PaymentProvider
  status                OrderPaymentStatus @default(PENDING)
  refundStatus          OrderRefundStatus  @default(NOT_REQUIRED)
  amountCents           Int
  refundedAmountCents   Int                @default(0)
  currency              String             @default("CAD")
  checkoutSessionId     String?            @unique
  providerPaymentId     String?            @unique
  providerOrderId       String?
  hostedCheckoutUrl     String?
  sessionExpiresAt      DateTime?
  paidAt                DateTime?
  failedAt              DateTime?
  refundRequestedAt     DateTime?
  refundedAt            DateTime?
  failureCode           String?
  failureMessage        String?
  rawProviderData       Json?
  webhookEvents         PaymentWebhookEvent[]
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt

  @@index([orderId])
  @@index([provider, status])
  @@index([refundStatus])
}

model PaymentWebhookEvent {
  id                 String          @id @default(cuid())
  provider           PaymentProvider
  providerEventId    String
  eventType          String
  checkoutSessionId  String?
  providerPaymentId  String?
  paymentId          String?
  payment            Payment?        @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  payload            Json
  processedAt        DateTime?
  createdAt          DateTime        @default(now())

  @@unique([provider, providerEventId])
  @@index([checkoutSessionId])
  @@index([providerPaymentId])
}
```

If Clover does not provide a stable event ID in a webhook payload, implementation should compute a deterministic idempotency key and store it as `providerEventId`.

### Event, Notification, Delivery, Driver, and Settings Models

```prisma
model OrderEvent {
  id                    String                  @id @default(cuid())
  orderId               String
  order                 Order                   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  actorType             OrderActorType
  actorId               String?
  actorLabel            String?
  eventType             String
  fromPaymentStatus     OrderPaymentStatus?
  toPaymentStatus       OrderPaymentStatus?
  fromFulfillmentStatus OrderFulfillmentStatus?
  toFulfillmentStatus   OrderFulfillmentStatus?
  message               String?
  metadata              Json?
  createdAt             DateTime                @default(now())

  @@index([orderId, createdAt])
  @@index([eventType])
}

model Notification {
  id                String             @id @default(cuid())
  orderId           String?
  order             Order?             @relation(fields: [orderId], references: [id], onDelete: SetNull)
  customerId        String?
  recipient         String
  channel           NotificationChannel
  templateKey       String
  body              String
  status            NotificationStatus @default(PENDING)
  provider          String?
  providerMessageId String?            @unique
  sentAt            DateTime?
  deliveredAt       DateTime?
  failedAt          DateTime?
  errorMessage      String?
  metadata          Json?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([orderId])
  @@index([status])
  @@index([recipient])
}

model DeliveryZone {
  id                         String   @id @default(cuid())
  name                       String
  isActive                   Boolean  @default(true)
  centerLatitude             Float
  centerLongitude            Float
  radiusKm                   Float
  deliveryFeeCents           Int      @default(0)
  minimumOrderCents          Int      @default(0)
  freeDeliveryThresholdCents Int?
  sortOrder                  Int      @default(0)
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  @@index([isActive, sortOrder])
}

model Driver {
  id             String             @id @default(cuid())
  supabaseUserId String?            @unique
  email          String             @unique
  name           String
  phone          String?
  isActive       Boolean            @default(true)
  assignments    DriverAssignment[]
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  @@index([isActive])
}

model DriverAssignment {
  id          String                 @id @default(cuid())
  orderId     String                 @unique
  order       Order                  @relation(fields: [orderId], references: [id], onDelete: Cascade)
  driverId    String
  driver      Driver                 @relation(fields: [driverId], references: [id], onDelete: Restrict)
  status      DriverAssignmentStatus @default(ASSIGNED)
  assignedAt  DateTime               @default(now())
  pickedUpAt  DateTime?
  deliveredAt DateTime?
  cancelledAt DateTime?
  createdAt   DateTime               @default(now())
  updatedAt   DateTime               @updatedAt

  @@index([driverId, status])
}

model RestaurantOrderSettings {
  id                         Int      @id @default(1)
  onlineOrderingEnabled      Boolean  @default(false)
  pickupEnabled              Boolean  @default(true)
  deliveryEnabled            Boolean  @default(false)
  scheduledOrdersEnabled     Boolean  @default(false)
  asapOnly                   Boolean  @default(true)
  restaurantLatitude         Float
  restaurantLongitude        Float
  deliveryRadiusKm           Float    @default(8)
  deliveryFeeCents           Int      @default(0)
  minimumDeliveryOrderCents  Int      @default(0)
  freeDeliveryThresholdCents Int?
  defaultPickupPrepMinutes   Int      @default(25)
  defaultDeliveryPrepMinutes Int      @default(45)
  busyModeEnabled            Boolean  @default(false)
  busyModeExtraMinutes       Int      @default(0)
  maxActiveOrders            Int?
  orderCutoffMinutesBeforeClose Int?
  gstRatePpm                 Int      @default(50000)
  qstRatePpm                 Int      @default(99750)
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
}
```

If `restaurantLatitude` and `restaurantLongitude` cannot be non-null safely at migration time, make them nullable for the first migration and require them in settings validation before delivery is enabled.

## State Machines

### Payment State

Payment status answers: what happened to the money?

```txt
PENDING -> PAID
PENDING -> FAILED
PAID -> REFUNDED
PAID -> PARTIALLY_REFUNDED
PARTIALLY_REFUNDED -> REFUNDED
```

Refund status answers: is there refund work to do?

```txt
NOT_REQUIRED
REQUIRED
PENDING
SUCCEEDED
PARTIAL
FAILED
```

### Fulfillment State

Fulfillment status answers: what should staff or drivers do next?

```txt
DRAFT
-> AWAITING_PAYMENT
-> AWAITING_ACCEPTANCE
-> ACCEPTED
-> PREPARING
-> READY_FOR_PICKUP
```

Pickup branch:

```txt
READY_FOR_PICKUP -> DELIVERED
```

Delivery branch:

```txt
READY_FOR_PICKUP
-> DRIVER_ASSIGNED
-> PICKED_UP
-> ON_THE_WAY
-> ARRIVING_SOON
-> DELIVERED
```

Problem branches:

```txt
AWAITING_ACCEPTANCE -> REJECTED
ACCEPTED/PREPARING/READY_FOR_PICKUP -> CANCELLED
```

Rejected paid orders must start refund processing.

## Pricing and Tax Principles

The public cart is never trusted for money.

Client sends:

```txt
menuItemId
quantity
modifierOptionIds
customer notes
tip amount or tip percent selection
pickup/delivery choice
address for delivery
```

Server calculates:

```txt
itemsSubtotalCents
taxableSubtotalCents
gstCents
qstCents
taxCents
tipCents
deliveryFeeCents
discountCents
totalCents
```

Tax rule for MVP:

```txt
taxableSubtotalCents = itemsSubtotalCents
gstCents = round(taxableSubtotalCents * gstRatePpm / 1_000_000)
qstCents = round(taxableSubtotalCents * qstRatePpm / 1_000_000)
taxCents = gstCents + qstCents
```

Tip is collected in Buffet Pin checkout and passed into the total sent to Clover.

Delivery fee handling should be explicit in code. Based on current decision, full tax applies to item subtotal. Do not silently tax tips. If delivery fee taxability changes, update the central calculator and order snapshots.

## Delivery Validation Principles

MVP delivery eligibility is distance-based.

Implementation requirements:

- Store restaurant coordinates in `RestaurantOrderSettings`.
- Geocode customer address server-side.
- Calculate straight-line distance with haversine unless a maps distance matrix provider is explicitly chosen.
- Validate distance against active delivery settings/zones.
- Store normalized address, latitude, longitude, and distance snapshot on `Order`.
- If geocoding fails, fail closed for delivery and let customer choose pickup or correct address.
- Do not trust client-calculated distance.

Recommended env for geocoding if using Google Maps through `fetch`:

```env
GEOCODING_PROVIDER=google
GOOGLE_MAPS_API_KEY=
```

If a different provider is chosen, keep a provider interface so validation logic is not coupled to one vendor.

## Clover Payment Principles

Payment flow:

```txt
1. Customer submits checkout.
2. Server validates cart/menu/prices/address/tip.
3. Server creates Order with paymentStatus=PENDING and fulfillmentStatus=AWAITING_PAYMENT.
4. Server creates Payment with provider=CLOVER and status=PENDING.
5. Server creates Clover Hosted Checkout session.
6. Server stores checkoutSessionId, hostedCheckoutUrl, sessionExpiresAt.
7. Customer is redirected to Clover.
8. Clover redirects customer to success/failure URL for UX.
9. Clover webhook verifies payment.
10. Webhook updates Payment and Order.
11. Paid order enters admin queue as AWAITING_ACCEPTANCE.
```

Clover env:

```env
CLOVER_ENV=sandbox
CLOVER_MERCHANT_ID=
CLOVER_PRIVATE_TOKEN=
CLOVER_WEBHOOK_SECRET=
CLOVER_API_BASE_URL=
```

Rules:

- Never mark paid in success page.
- Webhook route must verify signature using raw body.
- Webhook processing must be idempotent.
- Store raw provider payload in `PaymentWebhookEvent`.
- Keep failed/expired checkout state visible but out of fulfillment queue.

## Refund Principles

When admin rejects a paid order:

```txt
1. Admin submits rejection reason.
2. Server validates current order is rejectable.
3. Server sets fulfillmentStatus=REJECTED.
4. Server sets refundStatus=REQUIRED or PENDING.
5. Server calls Clover refund/void endpoint programmatically.
6. Server records success/failure result on Payment and Order.
7. Server inserts OrderEvent.
8. Server notifies customer and admin.
9. Admin problem/refund view shows any failed refund.
```

The refund call must be idempotent. If Clover supports idempotency keys for the chosen endpoint, use one derived from `order.id` and `payment.id`. If not, guard with local transaction state before external calls and store provider refund identifiers when available.

## Admin Fulfillment Principles

Admin should see operational buckets:

- New paid orders
- Preparing
- Ready
- Out for delivery
- Completed
- Problem/refund

Order cards should show:

- Public code/order number
- Pickup or delivery
- Customer name and phone
- Delivery address if delivery
- Items, modifiers, quantities, notes
- Paid total
- Requested time or ASAP
- Payment status
- Refund status
- Fulfillment status
- Accept/reject controls
- Prep estimate controls
- Driver assignment
- Print/view option

Use polling every 5 to 10 seconds for MVP. Follow the current reservation dashboard pattern rather than adding websockets.

## Customer Status Principles

Public status route:

```txt
/order/[publicCode]
```

Customer sees:

- Public order code
- Order summary
- Payment status
- Fulfillment status
- Pickup/delivery info
- Estimated pickup or delivery window
- Timeline from `OrderEvent`
- Restaurant contact info
- Support message

Rules:

- No live GPS.
- No fake progress bars.
- No fake precise countdowns.
- Poll `/api/orders/[publicCode]` for real updates.
- Show windows like `6:20-6:35 PM`, not exact promises.

## Driver Principles

Drivers authenticate with Supabase.

Driver pages:

- `/driver/orders`
- `/driver/orders/[id]`

Driver can only see assigned orders. Detail page shows:

- Customer name
- Phone link
- Address
- Map link
- Order contents
- Delivery notes
- Status buttons

Statuses:

```txt
ASSIGNED
PICKED_UP
ON_THE_WAY
ARRIVING_SOON
DELIVERED
```

Driver updates should also update the order fulfillment status and insert `OrderEvent`.

## Notification Principles

Reuse existing Twilio send plumbing, but add order-specific templates and a durable `Notification` log.

Events:

- Payment confirmed
- Order accepted
- Order rejected/refund pending
- Refund succeeded or failed
- Order preparing
- Ready for pickup
- Driver assigned
- Driver on the way
- Arriving soon
- Delivered

Do not block core order transitions because SMS fails. Log failure, show failure in admin, and allow manual resend later.

## Implementation Chain

Recommended global order:

1. Schema and internal types.
2. Menu and server pricing.
3. Distance-based delivery validation.
4. Checkout flow.
5. Clover Hosted Checkout.
6. Clover webhook reconciliation.
7. Automatic refund path.
8. Admin fulfillment.
9. Customer status page.
10. Driver flow.
11. Notifications.
12. Hardening and production checklist.

The first vertical milestone should be:

```txt
One mock ASAP pickup order with tip and tax
-> unpaid Order stored
-> Clover sandbox checkout created
-> webhook marks paid
-> admin sees order
-> admin accepts order
-> customer status page shows accepted timeline
```

## Production Hardening Checklist

Before launch:

- Clover sandbox paid order tested end-to-end.
- Clover duplicate webhook replay tested.
- Invalid Clover signature rejected.
- Abandoned checkout cleanup exists.
- Refund success and refund failure paths tested.
- Admin rejects paid order and refund status is visible.
- Distance validation tested with in-radius and out-of-radius addresses.
- Pricing test covers item subtotal, modifiers, tip, GST, QST, delivery fee, total.
- Customer status page exposes no internal IDs or private payloads.
- Driver cannot access unassigned orders.
- Existing reservation flow still works.
- Vercel env includes Clover, geocoding, Twilio, Supabase, DB, APP_URL, CRON_SECRET.
- `prisma migrate deploy` succeeds in staging.
- Admin can disable online ordering quickly.
