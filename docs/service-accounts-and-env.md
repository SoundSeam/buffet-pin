# Service Accounts and Env Setup

This project should use five external services:

1. Neon for Postgres
2. Supabase Auth for admin login
3. Clover for payments
4. Twilio for SMS
5. Vercel for hosting and cron

Set them up in that order. It avoids rework.

## 1. Neon

Create one Neon project for this app.

What to create:
- Project: `buffet-pin`
- Database: use the default `neondb`
- Branch: keep `main`

What to copy:
- Pooled connection string -> `DATABASE_URL`
- Direct connection string -> `DIRECT_URL`

Use:
- `DATABASE_URL` for the running Next.js app
- `DIRECT_URL` for `prisma migrate` and other Prisma CLI commands

Notes:
- The pooled host includes `-pooler`
- The direct host does not
- Keep `sslmode=require`

## 2. Supabase

Create one Supabase project for auth only.

What to configure:
- Authentication provider: Email/Password
- Disable public signups if you want admin access to be invite-only
- Create the first admin user manually in the Supabase dashboard

What to copy:
- Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key -> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Minimal admin authorization for v1:
- Keep one admin role only
- Gate `/admin` access in app code by checking whether `user.email` is included in `ADMIN_EMAILS`

Put the allowed emails in:
- `ADMIN_EMAILS=owner@example.com,staff@example.com`

## 3. Clover

Create or use one Clover merchant for payments.

What to configure:
- Use `CLOVER_CHECKOUT_MODE=hosted` for the Hosted Checkout fallback.
- Use `CLOVER_CHECKOUT_MODE=iframe` for embedded Clover iframe fields plus Ecommerce API charges.
- Configure Clover webhooks to call `/api/webhooks/clover`.

What to copy:
- Merchant id -> `CLOVER_MERCHANT_ID`
- Public access key -> `CLOVER_PUBLIC_ACCESS_KEY`
- Platform Orders/Inventory/Print token -> `CLOVER_PLATFORM_TOKEN`
- Ecommerce charges/refunds token -> `CLOVER_ECOMMERCE_PRIVATE_TOKEN`
- Hosted/Ecommerce webhook signing secret -> `CLOVER_WEBHOOK_SECRET`
- Platform webhook authorization value -> `CLOVER_PLATFORM_WEBHOOK_AUTH`

Notes:
- `CLOVER_PUBLIC_ACCESS_KEY` is browser-safe and required only for iframe mode.
- Both private tokens are server-only. Never expose either in client code.
- `CLOVER_PRIVATE_TOKEN` remains a local/sandbox compatibility fallback, but production validation requires the separated Platform and Ecommerce tokens.
- Buffet Pin Direct launch requires `CLOVER_CHECKOUT_MODE=iframe`; Hosted Checkout does not preserve the mapped order/payment/print identity and is not a launch fallback.
- See `docs/clover-checkout-modes.md` for the mode behavior and Hosted removal plan.

## 4. Twilio

Create one Twilio account. Do not use subaccounts for v1.

What to create:
- One SMS-capable phone number

Recommended:
- Use a toll-free number if you expect to message customers in the US or Canada

What to copy:
- Account SID -> `TWILIO_ACCOUNT_SID`
- Auth Token -> `TWILIO_AUTH_TOKEN`
- Sending phone number in E.164 format -> `TWILIO_FROM_NUMBER`

Notes:
- Trial accounts can block real-world messaging flows, so this works best with an upgraded account
- Keep the sender in full E.164 format, for example `+15145550123`

## 5. Vercel

Create or link the Vercel project after the service values above exist.

What to configure:
- Add all variables from `.env.example` into Vercel Project Settings
- Set them for `Development`, `Preview`, and `Production` as needed
- Keep `CRON_SECRET` for authenticated low-frequency operational routes and rollback compatibility
- Production AWS access uses Vercel OIDC; do not add `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`

What `APP_URL` should be:
- Local: `http://localhost:3000`
- Production: your canonical site URL, for example `https://buffetpin.com`

Async infrastructure:
- Production uses `ASYNC_JOBS_MODE=aws` and `NEXT_PUBLIC_REALTIME_MODE=appsync`
- There are no Vercel cron jobs. EventBridge Scheduler handles exact reminder deadlines and AWS runs hourly recovery.
- The production role trust is scoped to the Buffet Pin project/environment. Preview/development remain local unless separately authorized.

## Required Env Vars

These are the only env vars needed for the MVP:

```env
APP_URL=
ADMIN_EMAILS=
CRON_SECRET=
DRIVER_SESSION_SECRET=
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
CLOVER_CHECKOUT_MODE=
CLOVER_ENV=
CLOVER_MERCHANT_ID=
CLOVER_PUBLIC_ACCESS_KEY=
CLOVER_PLATFORM_TOKEN=
CLOVER_ECOMMERCE_PRIVATE_TOKEN=
CLOVER_WEBHOOK_SECRET=
CLOVER_PLATFORM_WEBHOOK_AUTH=
GEOCODING_PROVIDER=google
GOOGLE_MAPS_API_KEY=
PROVIDER_MODE=real
ORDERING_TEST_BYPASS=false
FAILURE_INJECTION_ENABLED=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
ASYNC_JOBS_MODE=inline
AWS_REGION=us-east-2
AWS_RUNTIME_ROLE_ARN=
AWS_CRITICAL_QUEUE_URL=
AWS_CRITICAL_QUEUE_ARN=
AWS_NOTIFICATION_QUEUE_URL=
AWS_NOTIFICATION_QUEUE_ARN=
AWS_SCHEDULER_GROUP_NAME=
AWS_SCHEDULER_ROLE_ARN=
AWS_SCHEDULER_DLQ_ARN=
AWS_CALLBACK_SECRET=
NEXT_PUBLIC_REALTIME_MODE=poll
NEXT_PUBLIC_APPSYNC_EVENTS_HTTP_URL=
NEXT_PUBLIC_APPSYNC_EVENTS_REALTIME_URL=
REALTIME_SIGNING_SECRET=
```

## Where Each Value Comes From

| Variable | Source |
| --- | --- |
| `APP_URL` | Your local URL or production domain |
| `ADMIN_EMAILS` | Manual list you choose |
| `CRON_SECRET` | Random secret you generate |
| `DRIVER_SESSION_SECRET` | A different random 32+ character signing secret |
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase API keys |
| `CLOVER_CHECKOUT_MODE` | `iframe` mapped-order checkout for delivery launch |
| `CLOVER_ENV` | `sandbox` or `production` |
| `CLOVER_MERCHANT_ID` | Clover merchant settings |
| `CLOVER_PUBLIC_ACCESS_KEY` | Clover Ecommerce public key, required for iframe mode |
| `CLOVER_PLATFORM_TOKEN` | Clover Platform Orders/Inventory/Print token, server-only |
| `CLOVER_ECOMMERCE_PRIVATE_TOKEN` | Clover Ecommerce charges/refunds token, server-only |
| `CLOVER_WEBHOOK_SECRET` | Hosted/Ecommerce webhook signing secret |
| `CLOVER_PLATFORM_WEBHOOK_AUTH` | Expected Platform webhook `X-Clover-Auth` value |
| `GEOCODING_PROVIDER` / `GOOGLE_MAPS_API_KEY` | Google address/routing configuration |
| `TWILIO_ACCOUNT_SID` | Twilio console |
| `TWILIO_AUTH_TOKEN` | Twilio console |
| `TWILIO_FROM_NUMBER` | Twilio purchased number |
| `ASYNC_JOBS_MODE` | `aws` in production; `inline` is the local/rollback default and `shadow` records without AWS dispatch |
| `AWS_REGION` | AWS stack region, currently `us-east-2` |
| `AWS_RUNTIME_ROLE_ARN` | CDK output `RuntimeRoleArn`; assumed through Vercel OIDC |
| `AWS_CRITICAL_QUEUE_URL` / `AWS_CRITICAL_QUEUE_ARN` | CDK critical-queue outputs |
| `AWS_NOTIFICATION_QUEUE_URL` / `AWS_NOTIFICATION_QUEUE_ARN` | CDK notification-queue outputs |
| `AWS_SCHEDULER_GROUP_NAME` / `AWS_SCHEDULER_ROLE_ARN` / `AWS_SCHEDULER_DLQ_ARN` | CDK Scheduler outputs |
| `AWS_CALLBACK_SECRET` | Generated secret shared only by relay/recovery Lambdas and encrypted Vercel environment configuration |
| `NEXT_PUBLIC_REALTIME_MODE` | `appsync` in production; `poll` is the rollback/default mode |
| `NEXT_PUBLIC_APPSYNC_EVENTS_HTTP_URL` / `NEXT_PUBLIC_APPSYNC_EVENTS_REALTIME_URL` | CDK AppSync Events outputs; public endpoints protected by channel-scoped authorization |
| `REALTIME_SIGNING_SECRET` | Generated server-only secret for short-lived AppSync channel tokens |

## Local Setup

1. Copy `.env.example` to `.env.local`
2. Fill in all values
3. Keep `.env.local` out of git
4. Later, mirror the same values into Vercel project env vars

## Recommended Launch Defaults

Use these operational defaults in code or seed data:

- Timezone: `America/Montreal`
- Minimum online party size: `6`
- Maximum online party size: `15`
- First slot: `16:30`
- Last slot: `20:00`
- Slot interval: `30`
- Modify/cancel cutoff hours: `24`
