# Milestone 03 — Clover order, payment, and kitchen printing

## Milestone

- Status: `MANUAL_VERIFICATION_REQUIRED`; repository implementation is automated-test complete, merchant/hardware verification remains external.
- Started/updated: 2026-07-22; branch `main` with preserved pre-existing work.

## Goal and scope

Create one mapped Clover Atomic Order, pay that exact order, reconcile server evidence, create one durable initial print intent in the paid transaction, and expose every failed/unknown print outcome. Implement real adapters behind testable boundaries; never infer success from redirects or a missing print event.

## Acceptance

- AC-301–308 and TR-001/TR-003/TR-005/TR-012 repository layers.
- Contract/failure/concurrency tests: unpaid rejection, duplicate/out-of-order paid callbacks, one initial job, Atomic Order + pay-for-order paths, print submission/observation failure and unknown outcomes, explicit attributed reprint.

## External gates

- Clover merchant IDs/tokens/permissions and real sandbox callbacks.
- Exact SP700-family submodel/suffix/interface/default firing device, legibility, one-print behavior, and offline recovery.

## Safety/rollback

- External order/print intents precede network work; timeouts become `UNKNOWN` and are reconciled, never blindly repeated.
- Missing/ambiguous mappings block before payment. Paid-but-unprinted work stays queryable.
- Production ordering remains disabled; no external calls are made during repository verification.

## Progress log

| Date | Change | Verification | Blocker |
|---|---|---|---|
| 2026-07-22 | Plan created; official Clover Atomic Order, pay-for-order, and `print_event` contracts rechecked. | Official docs reviewed; local implementation in progress. | Merchant/hardware evidence unavailable. |
| 2026-07-22 | Completed durable mapped-order/payment/print workflow, exact-one initial intent, labelled fallback/reprint, late-confirmation duplicate-risk alert and recovery UI. | Contract/unit/database/browser aggregate verification passed. | Clover/exact SP700-family printer evidence remains external. |
| 2026-07-22 | Added token-fenced callback/Clover-order claims, aged and rolling-deploy-compatible unknown recovery, exact order-number/total API evidence, monotonic print observation/finalization, and safe unpaid-checkout abandonment. | Concurrent stale-owner fencing, late print-finalizer, immutable/monotonic transition, same-total wrong-order rejection and recovery database tests plus operations UI/browser regression passed. | Provider/device behavior remains external. |
| 2026-08-03 | Controlled live order `BP-260803-0005` exposed that Clover production pay-for-order returns `status: paid`, exact `amount_paid`, charge ID and authorization evidence without the redundant `paid: true` boolean used by the original normalizer. The normalizer now accepts terminal paid status unless Clover explicitly contradicts it, while retaining exact order/currency/amount checks and authorization-only rejection. | Clover Platform API independently confirmed provider order `6EEK1K5BHGVWP` at $1.15 as `PAID` and payment `1JB67KHZSCHHY` at $1.15 as `SUCCESS`, attached to that exact order. Focused contract test, ESLint and TypeScript passed. An audited API-evidence recovery changed the local order from `PENDING` to `PAID`, created exactly one initial print intent, and submitted exactly once as print event `JX4EZ0HW9X5GW`. Onsite photo SHA-256 `ef6af467062621752374bad0dfb4313c085f433a4e8c8f79c2eb5cc6f382a98c` shows one legible matching ticket, but the onsite operator clarified that it came from the Clover POS printer, not the SP700. The earlier physical-confirmation audit was retained and explicitly corrected; the intended kitchen print is `FAILED` with `WRONG_PRINTER_TARGET` and a critical alert. | Payment/order/Print Orders transport succeeded, but MT-202/AC-307 failed because Clover's default firing device lacked the SP700 as its order printer and fell back to the POS printer. Correct merchant device/printer configuration before another paid order. |

## Final handoff

Repository behavior is code-complete. Deterministic print 4xx failures are retryable only through the original known-failed print intent; deterministic unpaid Clover-order failures are abandoned rather than retried because the payment source is never retained. Payment/order/print 408/409/429/5xx and transport outcomes remain unresolved. Stale workers and late submitters cannot regress newer states. Only `INITIAL` submits to Clover; `FALLBACK` and `REPRINT` require visible labels and physical confirmation. EG-001–008 remain open.
