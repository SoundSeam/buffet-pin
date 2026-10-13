# Clover Checkout Modes

Buffet Pin supports two Clover checkout modes behind `CLOVER_CHECKOUT_MODE`.

## `hosted`

Hosted Checkout is retained only as implementation history and is not a safe Buffet Pin Direct rollback path. It cannot prove that payment belongs to the mapped Clover order used for kitchen printing, so delivery intake fails closed unless `iframe` mode is configured.

- Customer submits the Buffet Pin checkout form.
- Server creates a local pending order/payment.
- Server creates a Clover Hosted Checkout session.
- Customer is redirected to Clover.
- Clover webhooks reconcile payment state.

Keep this mode available until iframe/API has been verified with real Clover sandbox credentials and at least one production smoke test.

## `iframe`

Iframe mode is the target embedded checkout flow.

- Buffet Pin owns cart, totals, customer fields, loading states, errors, and final redirect.
- Clover iframe owns only secure card fields.
- Browser tokenizes card details with `CLOVER_PUBLIC_ACCESS_KEY`.
- Browser sends only a Clover source token and idempotency key to `/api/checkout/create`.
- Server creates a local pending order/payment.
- Server charges the token with Clover Ecommerce API using `CLOVER_PRIVATE_TOKEN`.
- Server returns the order `publicCode` and tracking URL.
- Customer lands on `/order/{publicCode}`.
- Webhooks remain the source of truth and secondary reconciliation path.

Do not store card data. Do not send raw card data to Buffet Pin APIs.

## Deployment Env

Required for both modes:

```env
CLOVER_CHECKOUT_MODE=iframe
CLOVER_ENV=sandbox|production
CLOVER_MERCHANT_ID=
CLOVER_PRIVATE_TOKEN=
CLOVER_WEBHOOK_SECRET=
APP_URL=
```

Required only for `iframe`:

```env
CLOVER_PUBLIC_ACCESS_KEY=
```

Optional:

```env
CLOVER_API_BASE_URL=
```

Leave `CLOVER_API_BASE_URL` blank unless deliberately overriding Clover API host for local or sandbox diagnostics.

## Verification Status

The local QA pass on June 26, 2026 confirmed that iframe mode fails closed when `CLOVER_PUBLIC_ACCESS_KEY` is missing:

- `/api/checkout/config` returns `503 CLOVER_IFRAME_CONFIG_ERROR`.
- `/api/checkout/create` rejects iframe requests without a Clover source token.
- Existing hosted sandbox orders demonstrate webhook, tracking, admin, and driver lifecycle behavior.

Real iframe/API card authorization, declines, and refunds still require a configured Clover public access key and sandbox card test.

## Hosted Removal Plan

Do not remove Hosted Checkout yet. Remove it only after:

1. Successful iframe sandbox card charge is verified.
2. Declined iframe sandbox card is verified.
3. Duplicate submit/idempotency is verified against Clover.
4. Webhook replay is verified for iframe-created payments.
5. Reject/refund is verified against an iframe-created paid order.
6. Production env has `CLOVER_CHECKOUT_MODE=iframe` and has completed a real smoke test.

After those pass:

1. Remove Hosted Checkout session creation from `/api/checkout/create`.
2. Remove Hosted redirect success/failure pages.
3. Remove hosted-only env/docs references.
4. Keep webhook reconciliation.
5. Keep Ecommerce API helper/refund paths.
