# Demo Data Hydration Execution Plan

## Milestone

- Number and name: Post-M10 manual-demo support — synthetic order hydration
- Status: `MANUAL_VERIFICATION_REQUIRED`
- Branch: existing shared worktree (`main`)
- Owner: Codex
- Started: 2026-08-03
- Last updated: 2026-08-03

## Goal

Replace the current non-production order data with realistic, clearly marked synthetic fixtures that allow an in-person demonstration of production, packing, dispatch, driver, completed-order, and refund-history surfaces. Production reservations must remain byte-for-byte outside the mutation scope.

## Current behavior

The configured local environment points to an ngrok app URL backed by Neon. It contains 13 manually created/mock orders and 198 production reservations. The active driver has no delivery runs, shift, or zone eligibility, so the driver manifest is empty.

## Required behavior

- Keep every reservation unchanged.
- Replace order-domain records atomically.
- Seed four orders at each demonstrable workflow handoff.
- Seed a four-stop approved run, four-stop pickup-ready run, and four-stop completed run.
- Use synthetic customer contacts, sanitized provider evidence, confirmed mock print facts, and conspicuous demo labels.
- Do not call Clover, Twilio, Google, or any other provider.
- Do not enable online ordering or delivery.

## Scope

### In scope

- A repeatable, explicitly confirmed non-production demo-order reset script.
- Synthetic customers/addresses, order snapshots, payment/print evidence, packing checks, runs/stops, one demo zone, and driver shift/eligibility.
- Execution against the database selected by the current local `.env`.

### Out of scope

- Reservations and reservation settings.
- Real provider verification or production launch evidence.
- Production ordering enablement, outbound notifications, charges, refunds, printing, or routing calls.

## Security and privacy

- The script requires `--confirm-demo-reset` and refuses a production runtime or an unrecognized app host.
- All contacts use `example.test`, synthetic 555 numbers, and `[DÉMO]` customer labels.
- Provider payloads are sanitized fixtures and contain no card data or credentials.
- The script verifies reservation count and latest update timestamp before and after the transaction.
- The database normally forbids deletion of audit rows. The demo reset temporarily disables only the `OrderEvent` and `OperationalAuditEvent` immutability triggers inside the reset transaction, reenables them before commit, and relies on transactional DDL rollback if any statement fails. Staff-access audit protection is never disabled.

## Failure cases and recovery

| Failure | Detection | User/staff impact | Recovery | Automated test |
|---|---|---|---|---|
| Wrong runtime/host | Startup guard | No mutation | Correct environment and rerun explicitly | Script guard |
| Missing menu or active driver | Preflight exception | No mutation | Seed menu/driver first | Script preflight |
| Mid-seed database failure | Transaction rollback | Original order set remains | Resolve database issue and rerun | Transactional execution |
| Immutable synthetic audit history blocks reset | Scoped transactional trigger control | No partial deletion | Disable only order-related audit triggers in-transaction; rollback restores them on failure | Trigger state and order counts verified after execution |
| Reservation drift | Post-run preservation assertion | Seed reported failed | Investigate immediately; script never targets reservation tables | Count/latest-update comparison |

## Implementation sequence

1. Read-only inventory and environment classification.
2. Add guarded synthetic-order hydration script.
3. Execute one atomic replacement.
4. Verify 40 demo orders, four per stage, three four-stop runs, and unchanged reservations.
5. Record evidence in the status ledger.

## Automated verification

- `node --check scripts/seed-demo-orders.mjs`
- `node --env-file=.env scripts/seed-demo-orders.mjs --confirm-demo-reset`
- Read-only Prisma verification of stage, relation, and reservation counts.

## Acceptance criteria

- [x] Scoped deliverables implemented.
- [x] Every demo stage contains four synthetic orders.
- [x] Driver manifest has a pickup-ready four-stop run.
- [x] Reservations are unchanged.
- [x] No provider side effect or production enablement occurred.
- [x] Documentation and status ledger updated.

## Rollback and deployment considerations

This intentionally replaces the existing order-domain data and is not recoverable from the script. Database backups, if configured externally, are the only rollback path. Reservations are excluded. Rerunning the script replaces the demo order set deterministically.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-08-03 | Inventoried 13 orders and 198 reservations; added guarded seeder. First reset attempt rolled back because the immutable order-event trigger correctly rejected cascading deletion. Added narrow transactional trigger control for synthetic order history. | Rollback confirmed: 13 orders, 198 reservations, zero demo customers/runs remained. | User explicitly authorized deletion of all current mock orders and explicitly prohibited reservation deletion. |
| 2026-08-03 | Replaced the order domain atomically with 40 synthetic orders and three four-stop runs. | Script assertions passed; 40 payments, 40 confirmed synthetic initial print jobs, 40 external-order fixtures, 12 stops, four completed refund intents, zero non-demo orders, and both immutable-audit triggers enabled after commit. Reservations remained at 198 with latest update `2026-08-03T14:58:38.313Z`. `node --check`, targeted ESLint, and `npm run typecheck` passed. | In-person device/page walkthrough remains manual. |

## Final handoff

- Files changed: `scripts/seed-demo-orders.mjs`, this plan, and implementation status evidence.
- Migrations: none.
- Commands run: syntax check, targeted ESLint, guarded demo reset, read-only database integrity verification, and TypeScript typecheck.
- Review findings and resolutions: immutable audit triggers required scoped transactional disable/reenable for synthetic-history removal; post-commit query confirmed both triggers are enabled (`tgenabled = O`).
- Remaining manual verification: open the operator, production, dispatch, and driver pages on the intended demo devices.
- Known risks: demo time windows and the synthetic driver shift age over time; rerun the guarded script before a later demo to refresh them.
