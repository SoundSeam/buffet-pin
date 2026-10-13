## Milestone

- Number and name: Post-M10 admin deep-page style alignment
- Status: `MANUAL_VERIFICATION_REQUIRED`
- Branch: current user worktree
- Owner: Codex
- Started: 2026-08-03
- Last updated: 2026-08-03

## Goal

Bring the launch-era operational admin pages into the same visual and responsive system as the established admin settings pages without changing operational behavior, permissions, provider calls, or production state rules.

## Current behavior

The reservations, menu, drivers, and settings pages use a white full-height page, consistent top offset, restrained green palette, `rounded-surface` geometry, compact uppercase labels, accessible controls, and responsive headers. The catalog, dispatch, driver-operations, operations, production, and reconciliation components use inconsistent generic borders, radii, typography, spacing, control sizing, and page offsets.

## Required behavior

All scoped pages must use the same page shell, heading hierarchy, back navigation, action treatments, form controls, notices, panels, empty states, responsive wrapping, and focus behavior as the settings pages. Operational invariants and request payloads must remain unchanged.

## Scope

### In scope

- `/admin/catalog`
- `/admin/dispatch`
- `/admin/drivers/[id]/operations`
- `/admin/operations`
- `/admin/production`
- `/admin/reconciliation`
- Shared presentation primitives used by those pages

### Out of scope

- Customer, reservation, and driver-facing redesigns
- API, authorization, database, provider, or workflow changes
- Production deployment or external verification

## Dependencies

- Prior milestones: M0–M10 repository implementation
- External services or credentials: none for code verification
- Business decisions: none
- Manual/hardware gates: authenticated visual QA requires representative staff data

## Assumptions

- The two admin settings pages and established admin drivers page are the styling source of truth.
- Shared presentation primitives may be introduced additively; behavior-specific components remain separate.

## Expected change surface

### Files and modules

- `components/admin/admin-page-ui.tsx`
- Six scoped admin page components
- This plan and `docs/launch/IMPLEMENTATION_STATUS.md`

### Database changes

- None.

### API changes

- None. Existing authorization, idempotency, concurrency, and provider behavior are preserved.

### UI changes

- Manager/operator/dispatcher: consistent nested operational surfaces at desktop and mobile widths.
- Customer/driver: no change.

## Security and privacy

- No authentication or authorization changes.
- No new sensitive data or logging.
- Existing audited mutations and confirmations remain intact.

## Failure cases and recovery

| Failure                                    | Detection                     | User/staff impact          | Recovery                                        | Automated test              |
| ------------------------------------------ | ----------------------------- | -------------------------- | ----------------------------------------------- | --------------------------- |
| Long operational content overflows         | responsive visual/code review | inaccessible actions       | wrapping, min-width, and overflow styles        | browser/type/build checks   |
| Styling refactor changes a handler         | diff and existing tests       | operational action failure | retain request functions and payloads unchanged | existing unit/browser suite |
| Empty/loading/error state loses visibility | rendered-state review         | unclear page state         | shared notice/empty-state patterns              | browser review              |

## Implementation sequence

1. Extract styling vocabulary from settings and drivers pages.
2. Add small shared admin presentation primitives.
3. Refactor the six inconsistent operational components without changing behavior.
4. Run formatting, lint, type checking, relevant tests, and safe build.
5. Review desktop and narrow layouts and record results.

## Automated verification

- `npx tsc --noEmit`: PASS.
- Targeted ESLint for the shared UI, six components, and adjusted browser test: PASS with no findings.
- `npm run lint`: PASS with 0 errors and 28 pre-existing repository warnings.
- `npm test`: PASS; 196 tests across 17 files.
- `npm run build:safe`: PASS; all application routes compiled.
- Responsive browser inspection: PASS for actual components in error/empty states at 1440×900 and 390×844. All six pages matched the settings page's computed heading, surface, spacing, border, and radius treatments; none produced horizontal overflow or clipped controls.
- `npx playwright test tests/browser/authenticated-workflows.spec.ts`: NOT RUN. The disposable browser server stopped before tests because the local Docker daemon was unavailable.

## Manual verification

| Test                                     | Environment                    | Preconditions                                             | Expected result                                                       | Evidence                                                                        | Status  |
| ---------------------------------------- | ------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------- |
| Desktop structural visual review         | local development              | actual components with safe unauthenticated API responses | matches settings-page layout and control language                     | 1440×900 rendered inspection and computed-style audit                           | PASS    |
| Narrow structural visual review          | local development              | actual components with safe unauthenticated API responses | no clipped content or actions                                         | 390×844 rendered inspection; 0 overflow and 0 clipped controls on all six pages | PASS    |
| Authenticated representative-data review | disposable browser environment | Docker/PostgreSQL test runtime and seeded staff data      | populated queues, rows, and action groups preserve the aligned layout | browser suite could not start because Docker was unavailable                    | NOT_RUN |

## Acceptance criteria

- [x] Scoped deliverables implemented.
- [x] Applicable semantic structure, focus treatment, control sizing, and responsive layout reviewed.
- [ ] Authenticated browser suite passes with representative seeded data.
- [x] Authorization and audit behavior remain unchanged.
- [x] Failure states remain visible and recoverable.
- [x] Documentation and status ledger updated.
- [x] Diff reviewed for correctness, security, concurrency, and missing tests.
- [x] Remaining manual verification explicitly recorded.

## Rollback and deployment considerations

- Presentation-only changes are independently reversible.
- No feature flag or data rollback is required.
- No deployment is authorized by this task.

## Progress log

| Date       | Change                                                                            | Verification                                                           | Decision/blocker                                                                     |
| ---------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 2026-08-03 | Audited established settings styles and six inconsistent operational admin pages. | Source review                                                          | Settings pages confirmed as visual baseline.                                         |
| 2026-08-03 | Added shared admin presentation primitives and aligned all six scoped components. | Type, lint, unit, build, desktop and narrow browser inspection passed. | No behavior, API, permission, or data change.                                        |
| 2026-08-03 | Attempted the authenticated workflow suite.                                       | Test server stopped before execution.                                  | Local Docker daemon unavailable; representative populated states remain to be rerun. |

## Final handoff

- Files changed: shared admin page UI; catalog, dispatch, driver operations, operations/recovery, production, and reconciliation components; authenticated browser assertion; launch plan/status documentation.
- Migrations: none
- Tests added: no new test file; updated the catalog browser assertion for the new visual hierarchy.
- Commands run: Prettier, TypeScript, targeted ESLint, repository lint, Vitest, safe production build, responsive browser inspection, and an attempted authenticated Playwright run.
- Review findings and resolutions: replaced nested `<main>` output with the settings-page `<section>` structure; standardized every generic radius/control/header; confirmed all six pages have no narrow-viewport overflow.
- Remaining manual verification: rerun `tests/browser/authenticated-workflows.spec.ts` with Docker available and inspect populated desktop/narrow operational states with representative seeded data.
- Known risks: dense populated queue states were not rendered in this environment; behavior remains covered by the unchanged request handlers and existing browser test design.
- Recommended next action: start the disposable database runtime and rerun the authenticated browser workflow suite.
