# Payment State Hardening Verification

Use this checklist when testing `CLOVER_CHECKOUT_MODE=iframe` in sandbox.

## Prerequisites

1. Set `CLOVER_CHECKOUT_MODE=iframe`.
2. Set `CLOVER_ENV=sandbox`.
3. Set `CLOVER_MERCHANT_ID`.
4. Set `CLOVER_PUBLIC_ACCESS_KEY` so the browser can tokenize Clover iframe fields.
5. Set server-only `CLOVER_PRIVATE_TOKEN` so the Ecommerce API charge can run.
6. Set `CLOVER_WEBHOOK_SECRET` and configure Clover webhooks to call `/api/webhooks/clover`.

## Double-click / duplicate submit

1. Submit `/order/checkout` once and rapidly click the pay button again.
2. Confirm only one Clover charge is created for the card.
3. Confirm duplicate local requests resolve to the same `Payment.providerIdempotencyKey`.
4. Confirm duplicate responses return the same order `publicCode` / tracking URL.

## Idempotency retry

1. Re-send the same `/api/checkout/create` payload with the same `cloverPayment.idempotencyKey`.
2. Confirm the API returns the original local order instead of creating a second payable order.
3. Confirm the database has one payment row for the idempotency key.

## Ambiguous API result

1. Simulate a Clover network/API failure after creating the local pending payment.
2. Confirm the local payment remains `PENDING`, not `FAILED`.
3. Confirm the order remains `AWAITING_PAYMENT`.
4. Confirm a later webhook can move the same payment/order to `PAID` and `AWAITING_ACCEPTANCE`.

## Webhook ordering

1. Replay a paid webhook before the browser receives the API response.
2. Confirm the API response does not downgrade the already-paid payment.
3. Replay the same webhook again.
4. Confirm webhook idempotency reports duplicate processing and creates no duplicate state transition.

## Declines and terminal failures

1. Use a Clover sandbox decline card.
2. Confirm `/api/checkout/create` returns `CLOVER_PAYMENT_DECLINED`.
3. Confirm local payment/order are `FAILED`.
4. Confirm the order does not enter the admin acceptance queue.

## Pending / 3DS

1. Use a sandbox scenario that returns pending/3DS-required status.
2. Confirm local payment remains `PENDING` and order remains `AWAITING_PAYMENT`.
3. Confirm webhook reconciliation is required before admin fulfillment.

## Reject / refund

1. Place a paid iframe order.
2. Reject it in admin.
3. Confirm refund logic can refund by `providerPaymentId` or `providerOrderId`.
4. Confirm a failed void attempt falls back to the refund endpoint.
