# Milestone 01 — Domain and database foundation

## Milestone

- Number and name: M1 — Domain and database foundation
- Status: `CODE_COMPLETE` (terminology/number-format staff review remains manual)
- Branch: `main` (pre-existing dirty worktree; no branch mutation)
- Owner: Codex primary agent
- Started: 2026-07-22
- Last updated: 2026-07-22

## Goal

Represent order identity, payment/print/production/refund/dispatch facts, staff roles, and one-to-four-stop delivery runs independently and durably without breaking historical orders or the legacy fulfillment projection.

## Current behavior

- `Order.publicCode` is both the customer tracking credential and human identifier.
- `OrderFulfillmentStatus` combines restaurant and delivery facts; packing and dispatch-desk placement do not exist.
- Provider order identity is an optional payment field; there is no durable print job.
- All allow-listed admins share authority. Drivers use revocable access tokens but are assigned directly to one order.
- Delivery zone selection is not snapshotted on `Order`; no run/stop model exists.
- Thirteen existing migrations, including three pre-existing untracked-but-applied migrations, pass from scratch and must not be edited.

## Required behavior

- Immutable unique operational number separate from high-entropy tracking credential, with backfilled historical compatibility.
- Independent production and dispatch states/timestamps while retaining legacy fulfillment reads during rollout.
- Durable external order and print jobs; one database-enforced initial intent per order and actor/reasoned reprints.
- Explicit staff role representation and auditable access changes.
- Delivery runs/stops with database/service enforcement for positions 1–4, distinct orders, and no duplicate active assignment.
- Immutable zone/promise/deadline snapshots and expanded event fields.

## Scope

### In scope

- Additive Prisma schema/migration, identity allocation/backfill, state machines, print-intent/run domain services, historical migration and concurrency tests.

### Out of scope

- Real Clover adapters, mapped catalog, production station UI, final permission-route rollout, routing optimization, and customer receipts.

## Dependencies

- Prior milestones: M0 `CODE_COMPLETE`.
- External services or credentials: none.
- Business decisions: O-002 order-number display format and staff terminology remain manager-review gates; safe recommended defaults are used in code.
- Manual/hardware gates: staff terminology/order-number review; whether Clover physically prints it remains M3.

## Assumptions

- New order numbers use `BP-YYMMDD-NNNN`, allocated transactionally per Montréal service date. Database-generated compatibility defaults keep old application code insert-compatible during rollout.
- `publicCode` remains a database compatibility field. New checkout/status links use `trackingToken`; legacy short-code lookup is cutoff-scoped to orders created before this migration.
- Run readiness/zone rules are service-layer M6 work; M1 enforces structural capacity and active-assignment invariants.

## Expected change surface

### Files and modules

- `prisma/schema.prisma`, one new additive migration, `lib/orders/identity.ts`, `lib/orders/state-machines.ts`, `lib/orders/print-jobs.ts`, `lib/orders/runs.ts`, M1 tests, and launch evidence.

### Database changes

- Identity/sequence, external order, print job, production/dispatch fields, role/access audit, driver-zone eligibility, delivery run/stop, and event-state fields.
- Backfill from stable hashes/snapshots; retain every existing column and relation.
- Rollback disables new code; migration data remains. No drops/renames.

### API changes

- No public route contract removal. Domain services expose transactional allocation/intent/run primitives for later route integration.
- Concurrency uses serializable transactions with bounded `P2034` retry where multi-row invariants require it.

### UI changes

- Existing customer, admin, and driver projections retain their response shape while displaying `orderNumber`; customer URLs use only `trackingToken` for new orders.

## Security and privacy

- Operational number never authorizes public access; tracking tokens remain high entropy and are never intended for tickets/manifests.
- Staff access changes and privileged print/run mutations retain actor/reason evidence.
- Tests use synthetic data and the exact disposable database only.

## Failure cases and recovery

| Failure | Detection | User/staff impact | Recovery | Automated test |
|---|---|---|---|---|
| Concurrent number allocation | Serializable conflict/unique constraint | Request retry | Bounded P2034 retry | Yes |
| Duplicate initial print creation | Unique/check constraint | Existing intent returned | Idempotent read | Yes |
| Fifth or duplicate active stop | service and DB constraints | Run mutation rejected atomically | Correct run and retry | Yes |
| Invalid/stale state transition | transition guard | Mutation rejected | Refresh current state | Yes |
| Historical backfill | migration fixture query | Legacy order remains readable | Roll code back; preserve additive data | Yes |

## Implementation sequence

1. Add enums/models/fields and reviewed additive SQL migration with compatibility defaults/backfill.
2. Add identity, state, print-intent, and run services with transaction retry.
3. Add unit and disposable-database migration/invariant/concurrency tests.
4. Run aggregate verification and independent diff review; fix findings.
5. Update acceptance, traceability, decisions, risks, status, and manual evidence package.

## Automated verification

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test -- --run` | PASS; 135 tests, including identity credential and independent state guards |
| `npm run test:db` | PASS; 14 migrations, representative 13-migration historical upgrade, 5 database tests |

Database evidence covers 20 concurrent daily-sequence allocations, identity immutability, 12 concurrent initial-print requests producing one row/event, unpaid-print rejection, attributed reprints, concurrent fifth-stop rejection, and duplicate active-assignment rejection.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
| Terminology and number format review | Staff workflow review | Representative legacy/new order records | Staff accepts visible terminology and number format | Manager sign-off | NOT_RUN |

## Acceptance criteria

- [x] AC-101–106 and applicable repository layers of AC-G04–G06 pass.
- [x] Existing orders remain readable after migration fixture.
- [x] New state/identity/run invariants pass concurrency tests.
- [x] Documentation/status updated and manual terminology/number-format gate named honestly.

## Rollback and deployment considerations

- Feature flags: consumers remain off until later milestones.
- Backward compatibility: no existing columns removed; database defaults support old writers.
- Data rollback limitations: new identity/audit facts should not be deleted after use.
- Operational rollback: old code continues using `publicCode`/legacy fulfillment while new tables remain inert.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-07-22 | Plan created after M0 acceptance. | M0 aggregate PASS. | External terminology review deferred; implementation proceeds with reversible defaults. |
| 2026-07-22 | Added additive identity, state, external-order, print-job, staff-role, driver-zone, run/stop, audit, snapshot, and deadline persistence. Wired identity into checkout, tracking, notifications, Clover checkout notes, and staff/driver projections. | Typecheck, 135 unit/contract tests, historical migration, and database concurrency suite pass. | Legacy tracking compatibility is cutoff-scoped; new order numbers never authorize tracking. |

## Final handoff

- Repository layer is `CODE_COMPLETE`. No provider or physical behavior is claimed.
- Remaining gate: manager reviews `BP-YYMMDD-NNNN` and operational terminology, then records evidence for O-002.
