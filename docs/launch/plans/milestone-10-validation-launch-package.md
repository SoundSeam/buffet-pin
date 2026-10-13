# Milestone 10 — Complete system validation and launch package

## Milestone

- Number and name: M10 — Complete system validation and launch package
- Status: `MANUAL_VERIFICATION_REQUIRED`
- Branch: `main` (dirty user-owned worktree; no branch mutation)
- Owner: Codex
- Started: 2026-07-22
- Last updated: 2026-08-03

## Goal

Produce a reproducible repository release candidate and an ordered evidence package for every credentialed, physical, staff, legal/accounting, field, hosting, backup, and controlled-production gate.

## Current behavior

M0–M9 repository layers are implemented with deterministic provider/failure tests. No evidence from the merchant Clover environment, exact SP700-family submodel/interface, restaurant staff workflow, real routes, qualified Québec review, production hosting/backup, or authorized production smoke has been supplied.

## Required behavior

All automated checks must pass from a clean dependency install and disposable database. Production ordering remains disabled. External gates are executed in dependency order with redacted evidence and explicit go/no-go authority.

## Scope

- Aggregate automated verification, release evidence checklist, rollback/kill-switch procedure, ordered human tests, honest milestone status.
- Secret-safe environment/deployment preflight and a one-day onsite execution schedule.
- No deployment, real charge/refund, production mutation, ordering enablement, or external claim.

## Dependencies

- M0–M9 repository-verifiable work.
- External gaps EG-001–026 remain owned outside the repository unless evidence is attached.

## Automated verification

- `npm run verify`: PASS — lint 0 errors/28 warnings; typecheck; 200 tests across 18 files; 11 serial Chromium tests; 26 clean migrations and 38 DB tests across 9 files; Prisma validation; safe production build with 45 generated pages.
- `npm run security:audit`: PASS — 0 production dependency vulnerabilities. A separate full `npm audit --audit-level=high` also reports 0 vulnerabilities after updating Next.js to 15.5.22, PostCSS to 8.5.23, and brace-expansion to 5.0.8.

## Manual verification

See `docs/launch/RELEASE_EVIDENCE_CHECKLIST.md` and `MANUAL_TEST_PLAN.md`. No manual row is marked passed without exact-environment evidence.

## Acceptance criteria

- [ ] AC-1001 is partial: aggregate checks pass, while clean-worktree isolation, dedicated accessibility/performance, and deployed rollback evidence remain outstanding.
- [ ] AC-1002 external gaps closed/deferred/waived by owners.
- [ ] AC-1003 controlled production smoke authorized and evidenced.
- [ ] AC-1004 pilot controls/owners signed and kill switch rehearsed.

## Rollback and deployment considerations

- Production ordering remains disabled before and after code deployment until explicit go/no-go approval.
- Migrations are additive; code rollback does not erase durable intents/audits. Database restore is a separate externally evidenced last resort.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-07-22 | Validation plan, independent reviews and ordered evidence package completed | Aggregate `npm run verify` PASS; review findings fixed | All environment-specific gates remain manual |
| 2026-07-22 | Final safety review closed callback concurrency, payload binding, external-order recovery, privileged/print/notification audit and signed-routing evidence gaps; added authenticated workflow browser coverage. | Focused type/lint/unit/database/browser checks passed; final aggregate repeated on supported Node 22.13.0. | External gates unchanged. |
| 2026-07-22 | Closed residual P1 findings: ambiguous payment HTTP outcomes, stale-worker callback ownership, print-state regression, Clover-order recovery races/evidence, and missing cancellation refund outcomes. | Token-fencing and recovery database tests pass; final `npm run verify`, security audit and diff check pass. | Exact provider, hardware, staff and production evidence remains external. |
| 2026-07-22 | Final adversarial re-review closed late print-finalizer, orphan order retry, exact-order recovery, rolling-deploy compatibility, not-created dead-end and payment non-downgrade races. | Final reviewer reported no P0/P1 findings; exact post-fix aggregate, 25-migration clean apply, security audit and diff check pass. | Release remains no-go pending the ordered external checklist. |
| 2026-07-27 | Confirmed access availability for Clover (onsite day), Vercel, Supabase, Neon and Twilio; added secret-safe launch preflight and condensed one-day onsite plan. Corrected separated Clover production-token documentation and current dependency advisories. | Three preflight tests pass; final `npm run verify`, full dependency audit, and diff check pass. | Printer identity, date, business authority, professional receipt review and external evidence remain open. |
| 2026-07-27 | Reframed the onsite package around the product's single order-to-delivery chain and compressed the decisive external tests into a four-hour core plus two-hour recovery/production extension. | Manual test IDs and hard no-go conditions remain mapped; documentation diff check passes. | Remote release/configuration/approval prerequisites must be complete before the limited visit. |
| 2026-07-27 | Corrected the hardware fact from an unverified SP742-specific assumption to the user-reported SP700 family. Official Star specifications confirm multiple SP700 submodels and interfaces. | Printing architecture remains Clover-routed; external label/self-test/default-firing-device gates updated consistently. | Exact submodel, suffix, interface and physical behavior remain open until onsite inspection. |
| 2026-07-27 | Added the dated plain-English July 28 execution checklist, separated sandbox-money proof from live-merchant physical-printer proof, and added manager UI for pilot cap, busy mode, partial-refund policy and receipt identity. | Aggregate `npm run verify` passes: 196 non-database tests, 9 Chromium tests, 37 database tests, 25 clean migrations, Prisma validation and safe production build. | Release commit/deployment, merchant configuration, physical printer, live money, staff, receipt approval, backup/support and signed go/no-go remain external. |
| 2026-08-03 | Replaced the checklist-heavy machine console with a manager-only deployed/live-Clover runner: **Run live test** refuses to run while public ordering is on, performs a read-only live merchant check, and issues a random HTTP-only 15-minute grant that atomically admits one checkout only. It isolates that real paid order, diagnoses payment/Clover/print states, and asks whether the SP700 produced one, zero, or multiple tickets. It never creates or bypasses payment, submits a second print, retries uncertainty, or exposes credentials/PII. | Focused plain-diagnosis tests, authenticated/unauthenticated Chromium tests, and a database concurrency test proving the grant cannot admit two orders pass; final aggregate evidence is recorded in the status ledger. | The runner diagnoses software/provider facts but physical output still needs the tester's observation and retained evidence; EG-001–008 remain manual. |

## Final handoff

- Repository status: all safely repository-verifiable launch behavior is code-complete; shared pre-existing worktree prevents a clean-checkout claim.
- Launch status: no-go until every blocker in the evidence checklist is closed or formally waived by its accountable owner.
