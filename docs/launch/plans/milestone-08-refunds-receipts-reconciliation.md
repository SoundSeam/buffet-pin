# Milestone 08 — Refunds, receipts, and reconciliation

## Milestone

- Number and name: M8 — Refunds, receipts, and reconciliation
- Status: `MANUAL_VERIFICATION_REQUIRED` (repository behavior code-complete; Clover/reporting/SMS/legal evidence external)
- Branch: `main` (dirty user-owned worktree; no branch mutation)
- Owner: Codex
- Started: 2026-07-22
- Last updated: 2026-07-22

## Goal

Provide durable, idempotent full-refund coordination, customer-safe digital receipts from immutable order snapshots, idempotent notifications, and an explainable daily app/Clover reconciliation report. Partial refunds remain disabled by default.

## Current behavior

Refunds now use an atomically staged Ecommerce intent and retain unknown/review outcomes. Notifications use payload/parent-bound durable keys, audited provider submission/callback transitions, monotonic callbacks and manager-attested unknown recovery. Snapshot receipts and persistent daily import/variance reconciliation are implemented; only real provider, customer-message and professional receipt evidence remains external.

## Required behavior

Every paid cancellation or rejection uses one refund coordinator. Intent is durable before network I/O, retries reuse a provider key, ambiguous outcomes stay unknown until reconciled, and full success never regresses. Receipts and reconciliation use stored order/payment snapshots and the immutable operational order number.

## Scope

### In scope

- Durable refund intents, full refunds, explicit unknown/failure/recovery, manager authorization and audit.
- Idempotent notification creation.
- Digital receipt projection and customer tracking-credential route.
- Daily reconciliation report and mismatch queue projection.

### Out of scope

- Legal/accounting approval, real Clover refund execution, payout settlement verification, production notification delivery.

## Dependencies

- Prior milestones: M1 identity/domain, M3 provider payment identifiers, M5 capability policy.
- External services or credentials: Clover and Twilio are exercised through deterministic contracts/fakes only.
- Business decisions: partial refunds disabled unless a manager explicitly enables them.
- Manual/hardware gates: Québec receipt review and Clover sandbox/production evidence.

## Expected change surface

- Database: additive `RefundIntent`, notification idempotency, receipt configuration, partial-refund flag.
- API: authorized refund/recovery, customer receipt, reporting reconciliation.
- External behavior: Ecommerce refund endpoint only; no cloud void assumption; unknown is durable.

## Security and privacy

Refunds require `REFUND_WRITE`; reports require `REPORTING_READ`; receipt access requires the private tracking credential. Provider payloads are sanitized and never contain card data.

## Failure cases and recovery

| Failure | Detection | Impact | Recovery | Test |
|---|---|---|---|---|
| Provider timeout | `UNKNOWN` intent | Refund needs review | Reconcile same intent/key | failure injection |
| Duplicate request | unique request key | No duplicate refund | Return prior intent | concurrency test |
| Partial request disabled | settings guard | Request rejected | Manager policy decision | unit/integration |
| Reconciliation variance | report exception | Visible close gap | Manager investigates IDs/totals | fixture test |

## Implementation sequence

1. Add additive durable schema and migration.
2. Replace refund request path with Ecommerce contract and durable coordinator.
3. Add receipt, notification idempotency, reconciliation and authorized APIs.
4. Add unit/database/contract/failure tests; update launch evidence.

## Automated verification

- `npm run verify`: PASS in the M0–M10 aggregate; 196 non-database tests, 37 database tests, 25 clean migrations, 9 Chromium tests and safe production build.
- Refund contract tests cover success, 408/409/429/5xx, malformed success and transport unknown. Database tests cover concurrent replay, one provider call, partial default-off and durable unknown.
- Reconciliation fixtures cover exact match, duplicate/provider-only rows and amount/refund/tip/tax/delivery-fee/currency/order-ID/unknown variance, including DST-correct service days.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
| Refund contract | Clover sandbox | mapped paid order | one refund, identifiers retained | sanitized Clover evidence | NOT_RUN |
| Receipt compliance | Québec professional review | configured receipt | required business/tax fields approved | signed review | NOT_RUN |

## Acceptance criteria

- [x] AC-801–806 repository-verifiable portions pass.
- [x] Automated checks pass and failure states are recoverable.
- [x] Documentation/status evidence current.
- [x] External gates explicitly retained.

## Rollback and deployment considerations

- Additive migration; feature remains behind disabled production ordering and manager capability.
- Durable intents and immutable audit evidence are retained on rollback.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-07-22 | Completed atomic paid-stop refund staging, race-safe refund finalization, notification unknown recovery, private receipt and durable reconciliation import/variance UI. | Aggregate `npm run verify` passed. | External Clover/Twilio/report/legal evidence remains manual. |
