# Service Accounts and Env Setup

This project should use four external services:

1. Neon for Postgres
2. Supabase Auth for admin login
3. Twilio for SMS
4. Vercel for hosting and cron

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

## 3. Twilio

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

## 4. Vercel

Create or link the Vercel project after the service values above exist.

What to configure:
- Add all variables from `.env.example` into Vercel Project Settings
- Set them for `Development`, `Preview`, and `Production` as needed
- Generate a random cron secret for `CRON_SECRET`

What `APP_URL` should be:
- Local: `http://localhost:3000`
- Production: your canonical site URL, for example `https://buffetpin.com`

Cron:
- The reminder job should call a protected internal route
- Vercel cron protection should rely on `CRON_SECRET`

## Required Env Vars

These are the only env vars needed for the MVP:

```env
APP_URL=
ADMIN_EMAILS=
CRON_SECRET=
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

## Where Each Value Comes From

| Variable | Source |
| --- | --- |
| `APP_URL` | Your local URL or production domain |
| `ADMIN_EMAILS` | Manual list you choose |
| `CRON_SECRET` | Random secret you generate |
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase API keys |
| `TWILIO_ACCOUNT_SID` | Twilio console |
| `TWILIO_AUTH_TOKEN` | Twilio console |
| `TWILIO_FROM_NUMBER` | Twilio purchased number |

## Local Setup

1. Copy `.env.example` to `.env.local`
2. Fill in all values
3. Keep `.env.local` out of git
4. Later, mirror the same values into Vercel project env vars

## Recommended Launch Defaults

Use these operational defaults in code or seed data:

- Timezone: `America/Montreal`
- Minimum online party size: `5`
- Maximum online party size: `12`
- First slot: `16:30`
- Last slot: `20:00`
- Slot interval: `30`
- Modify/cancel cutoff hours: `24`
