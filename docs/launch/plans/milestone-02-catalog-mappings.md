# Milestone 02 — Delivery catalog and Clover mappings

## Milestone

- Number and name: M2 — Delivery catalog and Clover mappings
- Status: `MANUAL_VERIFICATION_REQUIRED` (repository behavior code-complete; merchant catalog/owner evidence external)
- Branch: `main` (pre-existing dirty worktree; no branch mutation)
- Owner: Codex primary agent
- Started/updated: 2026-08-03

## Goal

Make the delivery storefront, server repricing, Clover mapped order, and historical snapshot share an explicit catalog contract that fails closed on unavailable or unresolved mappings.

## Current behavior

- Checkout already reprices active items/modifiers and sold-out state server-side and preserves snapshots.
- All active menu records are projected to the delivery storefront; channel ownership and provider mappings are absent.

## Scope and dependencies

- Add an explicit delivery channel flag and generic typed Clover catalog mappings/configuration using an additive migration.
- Add sync/mismatch reporting, checkout mapping validation, sanitized Atomic Order fixtures, and manager-facing API evidence.
- Retain app-owned editing as a reversible implementation mode while O-001 remains a manager gate.
- Physical printing, merchant import credentials, and real inventory validation remain M3/external gates.

## Safety and failure behavior

- Missing, stale, duplicate, disabled, or mismatched required mappings block checkout before payment.
- The machine-test availability bypass does not skip catalog mappings. A test checkout fails before order/payment creation when its live Clover mapping is absent or stale.
- Québec GST/TPS and QST/TVQ are separate, verified Clover tax mappings and are both attached to each line item. A Clover delivery-fee mapping is required only when the immutable local order actually has a delivery fee.
- Historical order snapshots do not reference mutable mappings.

## Acceptance and verification

- AC-201–206, TR-006/TR-021/TR-022.
- Unit/contract tests for projection, mapping report, mapped payload, unavailable/missing/stale failures.
- Disposable database migration and aggregate verification.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-07-22 | Added typed delivery mappings, manager semantic attestations, persistent missing/stale/disabled blockers, refresh/report UI, and checkout fail-closed validation. | Unit/provider/database tests and aggregate `npm run verify` pass. | O-001 and real merchant mapping remain manual. |
| 2026-08-03 | Corrected the live machine-test path after `BP-260803-0001` exposed missing mappings: availability bypass can no longer bypass mapping checks; Atomic Order now carries separate TPS and TVQ IDs; zero-fee tests no longer require the merchant's disabled percentage service charge; early failures appear in machine diagnostics. Added and ran an idempotent, exact-match Clover item/category provisioner with audited mapping writes and unknown-outcome protection. | `npx tsc --noEmit` PASS; 201 repository tests PASS; `npm run test:db` PASS with 27 migrations and 38 tests; Prisma validation PASS. Production database migration applied. Live Clover created `Sides` and `Pork Dumplings`; five current `VERIFIED` mappings cover the category, item, TPS, TVQ and Delivery order type. Owner-authorized temporary price was then synchronized to $0.01 and the local pricing endpoint returned a one-cent total. | The controlled zero-fee Pork Dumplings checkout is mapped. Restore/approve the real menu price after testing. Full pilot catalog/modifier/service-charge mapping, menu ownership and physical checkout/print evidence remain external. |
| 2026-08-03 | Live order `BP-260803-0004` exposed two fail-closed contract defects before printing: the test item lacked explicit TPS/TVQ inventory associations, and the Atomic Order total guard read only a nested checkout shape while production creation returned top-level `total`. Catalog refresh now expands item tax rates, catalog health and checkout require both verified tax associations per item, the provisioner creates and reads back both associations, and order creation accepts only a safe integer total from either documented response shape before payment. Missing or unequal totals are a terminal pre-payment failure. | Clover now reports Pork Dumplings at $1.00 with both TPS and TVQ. A non-ordering Atomic Checkout preview returned exactly $1.15. The final focused test set passed 24 tests across three files; targeted ESLint and TypeScript passed. No retry, refund, or print was triggered. | `BP-260803-0004` remains an intentionally unresolved historical attempt with zero Clover payments and zero print jobs. Use a new order for the next controlled test. |

## Final handoff

- Repository behavior is code-complete. Review corrections included separate Québec tax mappings, conditional service-charge dependency, strict machine-test mapping enforcement, the singular Clover default-service-charge endpoint, deleted/hidden handling, exact financial semantics, and durable rows/alerts for never-configured mappings. The controlled Pork Dumplings test path is live-mapped; the full delivery catalog, ownership procedure and zero-blocker report remain EG-004/005.
