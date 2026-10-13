# Admin Orders Control Room Redesign

## Milestone

- Number and name: Post-M11 admin Orders control-room redesign
- Status: `CODE_COMPLETE`
- Branch: current user worktree
- Owner: Codex
- Started: 2026-08-13
- Last updated: 2026-08-13

## Goal

Turn `/admin/orders` into a compact, responsive order-control workspace inspired by the supplied reference: searchable status filters, a scrollable order queue, and an adjacent selected-order detail panel. Keep the entire workspace inside the shared admin shell and retain Buffet Pin's established green, white, amber, and red presentation system.

## Current behavior

`components/admin/admin-orders-dashboard.tsx` renders one full-width section containing large stacked order cards. Each card repeats customer, item, status, and action details, while the full order opens in a viewport-level modal. The API already serializes independent payment, refund, production, dispatch, print, item, and audit facts, but the client dashboard type uses only part of that projection.

## Required behavior

The current-orders view must act as an intake-and-exception inbox, not a second Kitchen, Dispatch, recovery, and audit console. It must answer what needs attention, what order is selected, and the next safe action without escaping the shared `AdminPage` content gutter. Healthy infrastructure facts stay quiet; exceptional facts and recovery controls appear only when relevant. Search and four task-oriented filters operate locally on the already-authorized order projection. Kitchen and Dispatch remain authoritative for downstream work. Narrow layouts remain readable without horizontal page overflow.

## Scope

### In scope

- Search, stage filters, counts, and live-refresh presentation
- Compact order queue rows with one dominant status
- Persistent selected-order facts and items/totals
- Contextual next action and exception-only recovery controls
- Collapsed operational truth and audit activity
- Responsive stacked layout within the existing shell
- Existing fallback/reprint confirmation and rejection/refund actions
- Additive order projection fields already present in the database model
- Focused browser assertions and launch documentation

### Out of scope

- Database, migration, payment, refund, print, production, dispatch, routing, or authorization behavior changes
- New provider calls or production mutations
- Redesigning the separate Needs attention guidance page
- Changing the shared admin shell or navigation architecture

## Dependencies

- Prior milestones: M0-M11 repository implementation
- External services or credentials: none
- Business decisions: supplied visual reference and explicit request to retain the current styling philosophy and shell
- Manual/hardware gates: all existing launch gates remain unchanged

## Assumptions

- The reference is directional rather than a request to copy its out-of-shell dimensions or unrelated navigation.
- Existing production and dispatch pages remain authoritative for state-changing station work.
- Client-side filtering is appropriate for the endpoint's existing maximum 100-order authorized projection.

## Expected change surface

### Files and modules

- `components/admin/admin-orders-dashboard.tsx`
- `lib/orders/admin.ts`
- `tests/browser/authenticated-workflows.spec.ts`
- This execution record and `docs/launch/IMPLEMENTATION_STATUS.md`

### Database changes

- None.

### API changes

- Additive serialization of existing delivery-zone and promise snapshot fields.
- Existing `ORDERS_READ` authorization, mutation capabilities, idempotency, and provider behavior remain unchanged.

### UI changes

- Manager: denser order triage and selected-order review.
- Operator/dispatcher: no authoritative station-flow change.
- Customer/driver/reporting/developer: no change.

## Security and privacy

- The dashboard remains behind the existing authenticated `ORDERS_READ` route.
- Search is local and does not add customer data to URLs or logs.
- No raw card, provider credential, or new sensitive data is rendered.
- Existing privileged actions retain their server-side authorization and audit behavior.

## Failure cases and recovery

| Failure                                 | Detection                                  | User/staff impact                 | Recovery                                                                 | Automated test                        |
| --------------------------------------- | ------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| No order matches a filter               | Empty-state rendering                      | Queue appears blank               | Clear search or select another stage                                     | Browser assertion                     |
| Selected order disappears after refresh | Selection reconciliation                   | Stale detail could remain visible | Select the first remaining visible order or show the empty state         | Component logic/browser review        |
| Print outcome is unknown/failed         | Explicit operational-truth row and warning | Duplicate-ticket risk             | Route to Needs attention and retain audited fallback/reprint controls    | Existing print tests + browser review |
| Narrow viewport overflows the shell     | Responsive visual assertion                | Controls become clipped           | Stack queue/detail and keep horizontal scrolling limited to filter strip | Browser assertion                     |

## Implementation sequence

1. Extend the existing admin-order projection/type with current operational snapshot fields.
2. Build search/filter/count helpers and selection reconciliation.
3. Replace the stacked card/modal presentation with the queue/detail workspace.
4. Add focused authenticated browser assertions.
5. Run formatting, targeted lint, typecheck, tests, safe build, and available browser verification.
6. Review the diff and update this plan and the implementation ledger.

## Automated verification

- `npx eslint components/admin/admin-orders-dashboard.tsx lib/orders/admin.ts tests/browser/authenticated-workflows.spec.ts`: PASS with no findings.
- `npm run typecheck -- --pretty false`: PASS.
- `npm test -- --run`: PASS; 226 tests across 22 files.
- `npm run lint`: PASS with 0 errors and the existing 28 repository warnings.
- `npm run build:safe`: PASS; all 58 pages generated under strict safe configuration.
- Focused authenticated Chromium Orders workflow: PASS; a real manager session with three seeded order states verified search, stage filtering, selected-order reconciliation, desktop containment, desktop two-column geometry, mobile stacking, and zero document-level horizontal overflow.
- Follow-up first-principles workflow assertion: PASS; verified the exception-first default, absence of the redundant workspace strip, collapsed system evidence, In progress routing to Dispatch, and absence of print controls on healthy printed orders.
- Full authenticated Chromium file: STOPPED on its first unrelated pre-existing Clover catalog assertion because matching `MAPPING_MISSING` text is currently hidden. Serial mode skipped the remaining tests. The focused Orders workflow was run independently and passed before this broader attempt.

## Manual verification

| Test                               | Environment                              | Preconditions                                                           | Expected result                                                               | Evidence                                                            | Status |
| ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| Desktop populated Orders workspace | local authenticated Chromium at 1440×900 | disposable PostgreSQL, fake auth, seeded manager and three order states | Queue/detail remain inside the shell and match the reference hierarchy        | Visual screenshot review plus computed geometry assertion           | PASS   |
| Mobile populated Orders workspace  | local authenticated Chromium at 390×844  | same disposable environment                                             | Filter strip scrolls internally; queue and detail stack without page overflow | Visual full-page screenshot review plus computed overflow assertion | PASS   |

## Acceptance criteria

- [x] Scoped deliverables implemented.
- [x] Search, filters, selection, and operational truth are usable.
- [x] Existing authorization, audit, and print/refund safeguards remain unchanged.
- [x] Responsive behavior verified.
- [x] Applicable automated checks pass.
- [x] Documentation and status ledger updated.
- [x] Diff reviewed for correctness, security, and missing tests.
- [x] Remaining external/manual gates explicitly retained.

## Rollback and deployment considerations

- Feature flags: none.
- Backward compatibility: API additions are additive; existing routes/actions remain stable.
- Data rollback limitations: none; no migration or data writes.
- Operational rollback: revert the dashboard presentation and additive projection fields.

## Progress log

| Date       | Change                                                                                                                                                                                                                                                      | Verification                                                                                                                               | Decision/blocker                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-13 | Audited the supplied reference, current admin shell, order dashboard, authorized API projection, and launch constraints.                                                                                                                                    | Source and visual review; baseline typecheck passed.                                                                                       | Keep station mutations in their authoritative Kitchen/Dispatch pages and retain the existing audited print controls.                     |
| 2026-08-13 | Rebuilt Current orders as a searchable, filterable queue and selected-order detail workspace; added existing delivery-zone/promise snapshots to the projection.                                                                                             | Targeted lint and typecheck passed.                                                                                                        | All provider, print, refund, and station mutations retain their existing server routes and guards.                                       |
| 2026-08-13 | Added authenticated shell-containment/filter/mobile assertions and reviewed populated desktop/mobile screenshots.                                                                                                                                           | Focused Chromium, 226 tests, repository lint, typecheck, and safe build passed.                                                            | The broader serial browser file stops on an unrelated hidden Clover mapping assertion; the focused Orders workflow passes.               |
| 2026-08-13 | Reduced the page to an intake-and-exception inbox: removed redundant tabs and healthy-state telemetry, replaced six operational filters with four task views, prioritized exception/new/due work, added one contextual next action, and collapsed evidence. | Populated desktop/mobile review and the focused authenticated Chromium workflow passed; lint, typecheck, 226 tests, and safe build passed. | Routine Kitchen and Dispatch work remains in the authoritative station pages; print controls now render only for a real print exception. |

## Final handoff

- Files changed: Orders dashboard presentation, additive admin-order serialization fields, focused authenticated browser coverage, and launch documentation.
- Migrations: none.
- Tests added: populated Orders search/filter/selection and desktop/mobile shell-containment assertions.
- Commands run: targeted and repository lint, typecheck, Vitest, safe build, focused authenticated Chromium, full authenticated Chromium attempt, and local populated screenshot inspection.
- Review findings and resolutions: kept queue and detail inside the shared content gutter; reduced each row to order/customer/total/age/due/one state; made exceptions the default; retained safety facts behind disclosure; made one next action dominant; selected order reconciles after refresh and filtering; healthy orders do not expose print recovery.
- Remaining manual verification: none for the scoped presentation change. Existing Clover, printer, staff, road, legal/accounting, alarms, and production go-live gates are unchanged.
- Known risks: the endpoint still intentionally caps the authorized client projection at 100 orders; future higher-volume pagination is outside this design task. The unrelated hidden Clover mapping browser assertion should be repaired separately so the full serial file can complete.
- Recommended next action: review the populated page on the restaurant's intended staff device, then address the separate Clover catalog browser assertion.
