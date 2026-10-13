# Milestone 00 — Baseline, guardrails, and test infrastructure

## Milestone

- Number and name: M0 — Baseline, guardrails, and test infrastructure
- Status: `CODE_COMPLETE`
- Branch: `main` (pre-existing dirty worktree; no branch mutation)
- Owner: Codex primary agent
- Started: 2026-07-22
- Last updated: 2026-07-22

## Goal

Provide a deterministic, non-interactive verification baseline and narrow provider contracts with production-safe deterministic fakes so later milestones can be implemented without credentials or hardware.

## Current behavior

- `package.json` uses deprecated interactive `next lint`, has no test runners, and has no safe-build command.
- `lib/env.ts` rejects missing production secrets and sandbox-only currency overrides, but does not yet define provider/failure-injection modes or a test-database guard.
- Provider behavior is embedded in Clover, Google, and Twilio modules rather than exposed through one shared launch-test contract family.
- The local worktree contains extensive user-owned modified and untracked product work. M0 changes must remain additive and must not rewrite or stage unrelated files.

Baseline rerun on 2026-07-22:

| Command | Exit | Result |
|---|---:|---|
| `CI=1 npm run lint` | 1 | Deprecated `next lint` opened the interactive configuration prompt. |
| `npx tsc --noEmit` | 0 | Passed. |
| `npx prisma validate` | 0 | Schema valid; Prisma 7 config deprecation warning only. |
| `npm run build` | 1 | Compiled, then correctly rejected local production-invalid config: missing `DRIVER_SESSION_SECRET` and forbidden `CLOVER_TEST_CHARGE_CURRENCY`. |

## Required behavior

- Lint, type check, unit/integration/contract/browser foundations, Prisma validation/migration, and safe production build are reproducible and non-interactive.
- Tests cannot point at production or ordinary developer databases.
- Payment, Clover order/print, routing, geocoding, and notifications use deterministic fake contracts supporting success, terminal/transient failure, timeout/unknown, duplicate callback, and recovery where meaningful.
- Fake and failure-injection configuration is rejected when `NODE_ENV=production`.
- A thin in-memory M0 launch-flow harness reaches `DELIVERED` and exposes a recoverable paid-but-unprinted exception. This is baseline infrastructure, not a claim that later persistent production/run workflows exist.

## Scope

### In scope

- ESLint CLI configuration, Vitest, Playwright foundation, safe build script, isolated Postgres test harness, provider contracts/fakes, M0 tests, and baseline documentation.

### Out of scope

- Persistent M1 domain models, real Clover order/print calls, catalog mapping, production UI workflow, staff roles, delivery runs, and operational provider credentials.

## Dependencies

- Prior milestones: launch bootstrap documents only.
- External services or credentials: none.
- Business decisions: none; testing libraries and file layout are reversible implementation choices.
- Manual/hardware gates: local fake-flow smoke only; no provider or hardware verification.

## Assumptions

- Vitest is used for unit/integration/contract layers and Playwright for browser tests, consistent with current Next.js testing guidance.
- A disposable Docker Postgres container is the isolated database because the repository is on Prisma 6 and Docker is available. The destructive harness ignores caller URLs and is locked to its exact container role, port, database, and schema.
- M0 AC-006 is satisfied by a thin fake launch-flow harness. It will be superseded by persistent API/browser coverage as M1–M6 land.

## Expected change surface

### Files and modules

- `package.json`, `package-lock.json`, ESLint/Vitest/Playwright configuration.
- `lib/providers/*`, `lib/testing/*`, `tests/*`, `scripts/*`, and M0 launch documentation.
- Narrow additions to `lib/env.ts` and `.env.example` for provider/failure modes.

### Database changes

- New models/fields/enums/indexes: none.
- Migration/backfill strategy: apply existing migrations to a disposable test database.
- Compatibility and rollback: remove test harness/config only; no production data change.

### API changes

- Routes/contracts: provider TypeScript contracts only; no public route changes.
- Authorization: no new privileged route.
- Idempotency/concurrency: deterministic fake call keys and duplicate callback scenarios.
- External provider behavior: no external calls from default tests.

### UI changes

- Customer/order controller/dispatcher/driver/manager: no production UI changes in M0.

## Security and privacy

- Production rejects fake providers, failure injection, test bypasses, and unsafe test DB configuration.
- Fixtures contain synthetic data only; no raw card data, credentials, addresses, or phone numbers.
- Provider observations expose sanitized identifiers and status, not secrets.

## Failure cases and recovery

| Failure | Detection | User/staff impact | Recovery | Automated test |
|---|---|---|---|---|
| Test URL targets non-isolated DB | Guard rejects before Prisma runs | Test aborts safely | Use disposable `_test` DB | Yes |
| Fake enabled in production | Environment validation rejects startup/build | Ordering stays closed | Deploy real/disabled provider config | Yes |
| Provider timeout after submit | Fake returns `UNKNOWN` | Work remains non-repeatable without reconciliation | Query/recover scenario | Yes |
| Print terminal/offline failure | Fake flow records visible paid-unprinted exception | Staff must recover | Explicit recover action | Yes |

## Implementation sequence

1. Add deterministic lint/test/build tooling and disposable DB harness.
2. Add provider contracts, scenario-controlled fakes, and fake launch-flow harness.
3. Add unit, contract, integration, environment, database-guard, and browser-foundation tests.
4. Run baseline commands and fix failures.
5. Review the M0 diff and update launch status, traceability, risks, decisions, and this evidence record.

## Automated verification

- Unit/integration/contract/failure tests: `npm run test` PASS, 130 tests.
- Browser: `npm run test:browser` PASS, 1 Chromium test against the real Next.js dev server.
- Database: `npm run test:db` PASS, all 13 migrations plus schema smoke against disposable PostgreSQL 16; container removed.
- Aggregate: `npm run verify` PASS under Node 22.13.0.
- Security: `npm run security:audit` PASS, 0 vulnerabilities.
- Lint retained 28 visible pre-existing warnings and 0 errors. TypeScript, Prisma validation, and the strict safe production build passed.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
| Fully fake order flow | Local development, Node 22.13.0, Chromium | No provider credentials; non-production fake mode | Delivered flow and recoverable print exception are observable | `npm run test:browser`, 2026-07-22 | PASS |

## Acceptance criteria

- [x] Scoped deliverables implemented.
- [x] AC-G01, AC-G02, and AC-001–006 satisfied at the repository-verifiable layer.
- [x] Automated checks pass.
- [x] Failure states are visible and recoverable.
- [x] Documentation and status ledger updated.
- [x] Diff reviewed for correctness, security, concurrency, and missing tests.
- [x] Remaining external/manual gates explicitly recorded.

## Rollback and deployment considerations

- Feature flags: provider fake/failure modes default off and are production-forbidden.
- Backward compatibility: no runtime provider is switched by M0.
- Data rollback limitations: none.
- Operational rollback: remove new scripts/config without touching application data.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-07-22 | Baseline audit and plan created. | Type/Prisma pass; lint/build failures reproduced. | Dirty worktree retained; M0 edits will be additive. |
| 2026-07-22 | Added Node/ESLint/Vitest/Playwright/Prisma verification, provider contracts/fakes, production guards, fake-flow page, and clean CI workflow. | `npm run verify` and `npm run security:audit` pass. | No external credentials or production mutation. |
| 2026-07-22 | Fixed independent review findings. | 130 tests plus browser/database/build regression pass. | Exact DB binding; authoritative print observation; unknown reconciliation; callback recovery; idempotency; strong secrets; full scenario coverage. |

## Final handoff

- Files changed: package/tool configs, `.github/workflows/verify.yml`, `scripts/*` verification helpers, `lib/providers/*`, `lib/testing/*`, production env guards, development fake-flow page, tests, and launch evidence.
- Migrations: none added or edited in M0; 13 existing migrations verified in a disposable database.
- Tests added: 130 Vitest cases, 1 Prisma migration smoke, and 1 real Next/Chromium browser flow.
- Commands run: `npm run verify` PASS; `npm run security:audit` PASS with 0 vulnerabilities.
- Review findings and resolutions: fixed arbitrary test DB targeting, submission-as-print overclaim, fabricated unknown recovery, callback recovery/dedupe, request/start idempotency, incomplete scenario proof, weak secrets, browser bootstrap, and mutable audit coupling.
- Remaining manual verification: all real Clover, exact SP700-family printer, Twilio, Google, Supabase, staff, legal, and production gates remain explicitly unverified.
- Known risks: provider contracts are test foundations until real adapters are implemented in their owning milestones.
- Recommended next milestone/action: begin M1 domain and additive database foundation.
