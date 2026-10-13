# Baseline Test and Build Coverage

Last updated: 2026-07-22. This is the Milestone 0 evidence summary. It describes repository-verifiable behavior only and does not verify any external provider, merchant, hardware, staff, legal, or production environment.

## Toolchain

- Node is pinned to 22.13.0 in `.nvmrc`; `package.json` rejects Node 23 and permits supported Node 22/24+ lines.
- ESLint 9 runs through the non-interactive CLI with Next.js core-web-vitals and TypeScript rules.
- Vitest supplies unit, integration, provider-contract, and failure-injection tests.
- Playwright Chromium starts the real Next.js development server and exercises the production-forbidden `/dev/fake-order-flow` page.
- Prisma migrations run against disposable PostgreSQL 16 in Docker. The test URL guard requires loopback, the dedicated `buffet_pin_test` role, and a database name ending `_test` before any migration or query runs.
- `scripts/build-safe.mjs` supplies explicit inert production-shaped configuration, disables every fake/bypass, and retains strict production validation.

The library choices follow the official [Next.js 15 testing guide](https://nextjs.org/docs/15/app/guides/testing), [Playwright installation guidance](https://playwright.dev/docs/intro), and [Prisma integration-testing guidance](https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing).

## Commands

| Command | Layer | 2026-07-22 result |
|---|---|---|
| `npm run lint` | Static analysis | PASS; 0 errors, 28 pre-existing warnings retained as visible debt. |
| `npm run typecheck` | TypeScript | PASS. |
| `npm run test` | Unit/integration/contract/failure injection | PASS; 130 tests. |
| `npm run test:browser` | Browser fake flow on real Next dev server | PASS; 1 Chromium test. |
| `npm run test:db` | Disposable database, all migrations, schema smoke | PASS; 13 migrations and 1 DB test; container removed afterward. |
| `npm run prisma:validate` | Prisma schema | PASS. |
| `npm run build:safe` | Production compilation with inert safe config | PASS on Next 15.5.21. |
| `npm audit --omit=dev --audit-level=high` | Production dependency advisories | PASS; 0 vulnerabilities after dependency/override updates. |
| `npm run verify` | Deterministic sequential aggregate (lint, type, Vitest, browser, disposable DB, Prisma validate, safe build) | PASS. |
| `npm run security:audit` | Live registry/advisory check | PASS; 0 vulnerabilities. Kept separate because advisory state and network availability are mutable. |

## Provider contract coverage

| Provider boundary | Success | Terminal | Transient | Offline | Timeout/unknown | Duplicate | Recovery |
|---|---:|---:|---:|---:|---:|---:|---:|
| Payment/pay/reconcile/refund | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Clover order create/read | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Clover print submit/observe | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Routing matrix/stop order | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Geocoding | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Notification | Yes | Yes | Yes | Yes | Yes | Intent dedupe | Yes |

The fake result type represents terminal, retryable, and ambiguous outcomes separately. A timeout after submission is `unknown`; the fake order harness reconciles the existing print event and never blindly submits a second physical ticket. These contracts are M0 foundations, not evidence that a real adapter follows its provider's current protocol.

## Fake end-to-end baseline

With `PROVIDER_MODE=fake` outside production, `/dev/fake-order-flow` displays:

1. a deterministic paid, printed, accepted, prepared, packed, desk-ready, assigned, picked-up, en-route, delivered flow; and
2. a paid order with an injected offline print failure, named `ORDER_CONTROLLER` owner, explicit recovery action, and successful controlled recovery.

Production validation rejects `PROVIDER_MODE=fake`, failure injection, ordering test bypass, sandbox Clover mode, custom Clover API overrides, and sandbox-only charge currency. The development verification page independently calls `notFound()` in production.

## Known baseline debt

- ESLint reports 28 warnings in pre-existing application code, primarily raw `<img>` elements and unused symbols. They do not make lint interactive or fail the command, but remain visible for later cleanup.
- Prisma 6 reports that the `package.json#prisma` seed configuration will be deprecated in Prisma 7. The repository remains on Prisma 6 for this launch work; migration to Prisma 7 is not an M0 prerequisite.
- Browser installation is a one-time `npm run test:browser:install` step locally. `.github/workflows/verify.yml` installs Chromium and OS dependencies before verification on a clean runner.
- The aggregate database verification requires a running Docker-compatible daemon. It never falls back to the configured `.env` database.
- The legacy `prisma/seed.js` is not invoked by automated tests. Production/developer seed safety remains an explicit M9 operational hardening item.

## External verification retained

Real Clover Hosted Checkout, Atomic Orders, Platform webhooks, Print Orders, output from the exact configured SP700-family printer, Google routes/geocoding policy, Twilio delivery, Supabase staff sessions, and production hosting remain unverified. Their exact gates stay in `KNOWN_EXTERNAL_GAPS.md` and `MANUAL_TEST_PLAN.md`.
