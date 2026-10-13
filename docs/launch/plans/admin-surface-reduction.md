## Milestone

- Number and name: Post-M11 admin surface reduction
- Status: `MANUAL_VERIFICATION_REQUIRED`
- Branch: current user worktree
- Owner: Codex
- Started: 2026-08-13
- Last updated: 2026-08-13

## Goal

Reduce the authenticated admin from fourteen manager navigation destinations to four durable pages: Reservations, Orders, Menu, and Settings. Preserve reservations and orders as separate domains, preserve every safety-critical operational capability, and keep infrequent operational stages nested within Orders.

## Current behavior

`components/admin/admin-shell.tsx` exposes fourteen manager destinations. The legacy `/admin/orders` dashboard duplicates the newer production and run-based dispatch workflows, while its primary progression actions redirect to `/admin/production` or `/admin/dispatch`. Catalog editing, drinks, Clover mapping readiness, delivery zones, driver operations, recovery, reconciliation, settings, and the live machine test each occupy separate routes and navigation items.

## Required behavior

Reservations, Orders, Menu, and Settings appear as the manager's primary authenticated navigation. There is no Today dashboard or extra Overview layer. Orders contains the nested intake/print, kitchen/packing, dispatch, exceptions, and close-day modes. Operators, dispatchers, and reporting users see Orders only and land directly in their permitted stage. Menu contains delivery catalog, drinks, and Clover readiness. Settings contains reservation capacity, ordering/safety, delivery zones, drivers, and diagnostics. Old operational URLs remain compatible redirects.

## Scope

### In scope

- Four-item capability-aware manager navigation
- Role-aware `/admin` redirect behavior
- Standalone Reservations and Orders pages, with operational stages nested under Orders
- Compatibility redirects from removed page URLs
- Reduction of the legacy all-stage Orders dashboard to intake/print only
- Automated route/navigation assertions and launch documentation

### Out of scope

- API, database, provider, payment, print, refund, dispatch, or audit behavior changes
- Deleting legacy APIs or database fields
- Rewriting the large reservation editor or changing reservation rules
- Production deployment, Clover calls, printer tests, or go-live actions

## Dependencies

- Prior milestones: M0-M11 repository implementation
- External services or credentials: none
- Business decisions: user explicitly requested the reduction, the name "Orders", and the later removal of the intermediate Today page
- Manual/hardware gates: existing launch gates remain unchanged

## Assumptions

- Query-string workspace modes are navigation state within one durable route, not independent product areas.
- Existing operational components can be embedded behind consolidated workspace navigation without changing their request contracts.
- Compatibility redirects should be retained until bookmarks and operational documentation are migrated.

## Expected change surface

### Files and modules

- `components/admin/admin-shell.tsx`
- Shared admin workspace navigation for nested Orders, Menu, and Settings modes
- `app/admin/page.tsx`, `app/admin/menu/page.tsx`, and `app/admin/settings/page.tsx`
- Existing admin route entries converted to redirects
- Authenticated browser tests and launch documentation

### Database changes

- None.

### API changes

- None. Existing server-side capability checks remain authoritative.

### UI changes

- Manager: Reservations, Orders, Menu, and Settings.
- Operator: Orders opens production directly.
- Dispatcher: Orders opens dispatch directly.
- Reporting: Orders opens close-day reconciliation directly.
- Customer/driver: no change.

## Security and privacy

- Consolidated routes select components only after server-side staff authentication.
- Existing component APIs retain their server-enforced capability checks.
- No customer, card, provider, or audit data is added to URLs or logs.
- Live machine testing remains manager-only and explicitly separated under Diagnostics.

## Failure cases and recovery

| Failure                             | Detection                  | User/staff impact                | Recovery                                                                                      | Automated test            |
| ----------------------------------- | -------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| Old bookmark breaks                 | route test                 | staff cannot find a tool         | permanent compatibility redirect                                                              | route/browser assertion   |
| Role lands in unauthorized mode     | authenticated browser test | login loop or empty page         | server-selected role default                                                                  | role workflow assertions  |
| Hidden page loses capability        | route/component inventory  | operational recovery unavailable | expose it as a workspace mode before redirecting old route                                    | type/build/browser checks |
| Legacy Orders remains authoritative | source review              | conflicting state controls       | retain only intake/print decisions and route later stages to their authoritative Orders modes | source/browser assertion  |

## Implementation sequence

1. Add shared workspace navigation and role-aware admin routing.
2. Consolidate Menu and Settings behind their retained routes.
3. Replace removed page entries with compatibility redirects and reduce the primary shell navigation to three items.
4. Add or adjust authenticated workflow assertions.
5. Run lint, type, tests, safe build, and targeted browser verification where available.
6. Review the diff and update the status ledger and this execution record.

## Automated verification

- `npm run lint`: PASS with 0 errors and 28 existing repository warnings.
- `npm run typecheck`: PASS.
- `npm test`: PASS; 226 tests across 22 files, including deterministic role landing, nested Orders-stage routing, and standalone reservation filter URL generation.
- `npm run build:safe`: PASS; all 45 pages generated and the removed admin destinations compile as 381-byte compatibility redirect routes.
- `npx playwright test tests/browser/authenticated-workflows.spec.ts`: NOT RUN. The disposable browser server could not start because the local Docker daemon was unavailable; no browser test body ran.

## Manual verification

| Test                       | Environment                 | Preconditions                            | Expected result                                      | Evidence | Status  |
| -------------------------- | --------------------------- | ---------------------------------------- | ---------------------------------------------------- | -------- | ------- |
| Manager reduced navigation | local authenticated browser | seeded manager                           | Reservations, Orders, Menu, and Settings appear      | pending  | NOT_RUN |
| Role-aware Orders          | local authenticated browser | operator, dispatcher, reporting fixtures | each role lands in its permitted nested Orders stage | pending  | NOT_RUN |

## Acceptance criteria

- [x] Four focused primary manager destinations implemented.
- [x] Old URLs redirect compatibly.
- [x] Legacy all-stage Orders dashboard removed from active navigation and reduced to intake/print.
- [ ] Authenticated role browser checks pass; Docker-backed execution remains to rerun.
- [x] Non-browser automated checks pass.
- [x] Documentation and status ledger updated.
- [x] Final diff review completed.
- [x] Remaining external/manual gates explicitly retained.

## Rollback and deployment considerations

- Feature flags: none; old route redirects provide compatibility.
- Backward compatibility: bookmarks retain functional redirects.
- Data rollback limitations: none; no data or migration changes.
- Operational rollback: restore the prior navigation and route entry components.

## Progress log

| Date       | Change                                                                                                                                                    | Verification                                                | Decision/blocker                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2026-08-13 | Audited all admin routes and recorded the three-workspace consolidation.                                                                                  | Source review                                               | User selected the label "Orders" for delivery operations.               |
| 2026-08-13 | Implemented role-aware Today, consolidated Menu and Settings, compatibility redirects, simplified order intake, and collapsed advanced ordering controls. | Lint, typecheck, 225 tests, and safe build passed.          | No API, database, provider, audit, or production change.                |
| 2026-08-13 | Updated authenticated role/workspace assertions and attempted the focused Chromium suite.                                                                 | Test server stopped before execution.                       | Docker daemon unavailable; populated browser verification remains open. |
| 2026-08-13 | Replaced the intermediate Today workspace with standalone Reservations and Orders pages while retaining nested Orders stages.                             | Typecheck, targeted lint, 226 tests, and safe build passed. | No API, database, provider, audit, or production change.                |

Follow-up on 2026-08-13: fixed the embedded reservation calendar URL synchronization so filter updates preserve `area=reservations` instead of returning Today to Overview. Typecheck, targeted tests, and the safe build were rerun. The browser specification now asserts that Reservations remains selected after its client-side URL replacement.

Tab-strip follow-up on 2026-08-13: changed every workspace selector from centered filled pills to bottom-docked tabs. Tabs now sit flush with the strip's lower rule, use square edges and transparent surfaces, and communicate selection with a 3px bottom border. The browser specification checks the selected tab's geometry and computed styling.

Standalone-page follow-up on 2026-08-13: removed the Today overview and promoted its two useful domains to `/admin/reservations` and `/admin/orders`. The manager sidebar now contains Reservations, Orders, Menu, and Settings. Orders retains its five nested stage tabs, while operational roles land directly in their authorized Orders stage. `/admin` is now a role-aware redirect, and legacy `area=orders` bookmarks plus the older production, dispatch, operations, and reconciliation routes redirect into the standalone Orders page.

## Final handoff

- Files changed: standalone Reservations and Orders route compositions; compatibility redirect routes; shared nested workspace navigation; reduced sidebar and intake surface; login landing; routing tests; authenticated browser assertions; launch plan/status/decision records. The Today summary component was removed.
- Migrations: none.
- Tests added: deterministic manager/operator/dispatcher/reporting landing and Orders-stage tests; updated browser assertions for four manager destinations and standalone Reservations/Orders routes.
- Commands run: Prettier, lint, typecheck, Vitest, safe build, and attempted focused authenticated Playwright.
- Remaining manual verification: rerun the authenticated workflow suite with Docker available and inspect manager desktop/mobile populated modes.
- Known risks: consolidated pages load larger client bundles than redirect routes; further component-level lazy loading is an optimization, not a correctness gate.
- Recommended next action: run the focused authenticated Chromium suite when Docker is available, then review the four manager pages on the restaurant's intended staff device.
