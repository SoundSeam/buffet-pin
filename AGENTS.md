# Buffet Pin Agent Guide

This repository contains the Buffet Pin public site, reservations, and the Buffet Pin Direct delivery-ordering system. For launch work, start with these files:

- `docs/launch/MASTER_PLAN.md` — authoritative delivery-launch roadmap.
- `docs/launch/IMPLEMENTATION_STATUS.md` — persistent milestone ledger; update it in every implementation task.
- `docs/launch/ACCEPTANCE_CRITERIA.md` — system-level automated and manual gates.
- `docs/launch/DECISIONS.md` — confirmed decisions, recommendations, assumptions, and unresolved choices.
- `docs/launch/KNOWN_EXTERNAL_GAPS.md` — facts that cannot be proven from the repository.
- `PLANS.md` — required template for milestone execution plans.

The older `docs/buffet-pin-direct-master-plan.md` is implementation history and useful context. Where it conflicts with `docs/launch/`, the launch documents govern unless the user explicitly decides otherwise.

## Repository map

- `app/` — Next.js App Router pages and route handlers.
- `components/` — customer, admin, driver, menu, reservation, and layout UI.
- `lib/orders/` — pricing, delivery validation, status rules, admin/driver operations, refunds, and notifications.
- `lib/clover/` — Clover clients, Hosted Checkout, Ecommerce charges, webhooks, and refunds.
- `lib/supabase/` and `lib/driver-access.ts` — admin and driver authentication.
- `prisma/schema.prisma` and `prisma/migrations/` — database schema and migrations.
- `docs/launch/` — launch architecture, plans, gates, risks, and operations.

## Commands and current baseline

- Development: `npm run dev`
- Type check: `npx tsc --noEmit`
- Production build: `npm run build`
- Prisma client: `npm run prisma:generate`
- Development migration: `npm run prisma:migrate`
- Seed: `npm run prisma:seed`

As of 2026-07-22:

- `npx tsc --noEmit` passes.
- `npm run build` compiles, then fails during page-data collection because the local `.env` is intentionally invalid for production (`DRIVER_SESSION_SECRET` missing and `CLOVER_TEST_CHARGE_CURRENCY` set). Do not weaken production validation to make this pass; use an explicit safe build environment during Milestone 0.
- `npm run lint` invokes deprecated interactive `next lint` and is not CI-safe. Milestone 0 must replace it with a non-interactive lint command.
- No automated test framework is configured. Adding one is Milestone 0 work.

## Working rules

1. Inspect `git status` before editing. Preserve all pre-existing changes and never discard, rewrite, or stage unrelated work.
2. Read the launch plan, status ledger, decisions, and applicable acceptance criteria before implementing a milestone.
3. Create or update a milestone execution plan using `PLANS.md`. Do not quietly expand into later milestones.
4. Prefer small, additive, reversible changes. Feature-flag incomplete external integrations.
5. Keep reservations and ordering as separate domains. Do not repurpose reservation models or routes for orders.
6. Update affected launch documentation and `docs/launch/IMPLEMENTATION_STATUS.md` before declaring work complete.
7. Do not claim real Clover, the exact SP700-family kitchen printer, Twilio, routing, or production behavior was verified unless evidence from that environment exists.

## Non-negotiable invariants

- Never accept, log, store, or transmit raw card data through Buffet Pin servers.
- A browser redirect is customer UX, not proof of payment. Server-side Clover reconciliation is authoritative.
- A confirmed payment must not be downgraded by a later failure or out-of-order webhook.
- Never release or print an unpaid order.
- Each order may have at most one initial kitchen print job. Reprints are explicit, audited, and visibly labelled.
- Payment requests, provider callbacks, print creation, refunds, and externally retried mutations must be idempotent.
- Every important payment, printing, production, packing, dispatch, driver, cancellation, and refund transition creates an immutable audit event with actor and timestamp.
- Every paid cancellation or rejection must enter the refund decision/workflow; changing fulfillment state alone is insufficient.
- A delivery run may contain no more than four orders.
- An order cannot be picked up until it is packed and recorded at the dispatch desk.
- A run stays within one delivery zone by default; cross-zone batching requires an explicit, audited dispatcher override.
- External failures must be visible and recoverable. Never silently drop a paid order, print job, notification, route request, or refund.
- Production online ordering remains disabled until a human explicitly completes the go-live checklist and enables it.

## Database and migrations

- Use additive Prisma migrations. Do not edit an already-applied migration.
- Avoid destructive drops, renames, or backfills without an explicit compatibility and rollback plan.
- Preserve historical snapshots on orders even if catalog, address, zone, or customer records later change.
- Put uniqueness constraints behind idempotency invariants, not only application-level checks.
- Keep external network calls outside long database transactions. Use durable intent/outbox records plus reconciliation for cross-system work.
- Include migration verification and compatibility notes in the milestone plan.

## External providers

- Put Clover Orders/Print, payment, routing, geocoding, and notification behavior behind narrow provider interfaces with deterministic fakes.
- Default tests to fakes or recorded sanitized fixtures. Never require production credentials for the normal test suite.
- Fail closed when a required production credential or provider configuration is absent.
- Never expose server credentials to browser code.
- Treat an external timeout after submission as an ambiguous outcome until reconciled; do not blindly repeat side effects such as payments or printing.

## Authorization

- Enforce permissions in route handlers and server modules, not only by hiding UI controls.
- Keep manager, operator, dispatcher, reporting, and driver capabilities explicit.
- Record the authenticated actor for privileged mutations.
- Driver access must be scoped, revocable, and limited to assigned work.
- Refunds, menu edits, staff access, settings, reprints, overrides, and reconciliation actions require audit evidence.

## Testing and verification

For every behavior change, add tests at the lowest useful level and at the relevant integration boundary. Milestone work is not complete until applicable checks pass or a genuine external/manual gate is recorded.

Expected verification layers after Milestone 0:

- Unit tests for pricing, status transitions, permissions, batching, and pure provider normalization.
- Database/API integration tests for transactions, idempotency, refunds, outbox jobs, and authorization.
- Contract tests for Clover orders, payments, webhooks, refunds, and print events using sanitized fixtures.
- Browser tests for customer checkout/status, staff production/packing, dispatcher runs, and driver completion.
- Failure-injection tests for provider timeouts, duplicate callbacks, offline printing, unavailable routes, and failed notifications.
- `npx tsc --noEmit`, non-interactive lint, all relevant tests, and a production build using safe non-production values.

Before accepting a milestone, review the diff for correctness, security, concurrency, missing tests, and documentation drift.

## Plans, status, and external gates

- Use one implementation milestone per branch where practical: `codex/launch-XX-short-name`.
- The status ledger values are `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `CODE_COMPLETE`, `MANUAL_VERIFICATION_REQUIRED`, and `VERIFIED`.
- `CODE_COMPLETE` means automated criteria pass. It never implies hardware, sandbox, staff, legal/accounting, or production validation.
- Stop and request direction only for a material business choice, destructive action, production mutation, unavailable credential, or external/manual gate that cannot be simulated safely.
- For ordinary ambiguity, choose the safest reversible design, record the assumption in `docs/launch/DECISIONS.md`, and continue.

## Subagents and parallel work

- Use subagents when the user or applicable instructions explicitly request delegation.
- Prefer parallel agents for independent read-heavy exploration, documentation research, test execution, and review.
- Keep coordinated writes with one primary implementation agent. Avoid parallel edits to the schema, migrations, shared state machines, provider contracts, or the same feature files.
- The primary agent owns integration, conflict resolution, final verification, and the status ledger.

## Git and production safety

- Never use destructive Git commands to clear user work.
- Stage or commit only files intentionally changed for the active milestone.
- Do not push, deploy, enable production ordering, charge a real card, issue a real refund, rotate production credentials, or mutate Clover production without explicit user authorization.
- Keep rollback paths and kill switches testable before go-live.

## Definition of done

A milestone is done only when its scoped deliverables exist, acceptance criteria are satisfied, relevant checks pass, the diff has been reviewed, documentation is current, the status ledger contains evidence, and every remaining external/manual verification item is named. If any of those are missing, report the milestone as incomplete rather than weakening the definition.
