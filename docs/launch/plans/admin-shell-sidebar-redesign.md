## Milestone

- Number and name: Post-M10 admin shell and sidebar redesign
- Status: `CODE_COMPLETE`
- Branch: current user worktree
- Owner: Codex
- Started: 2026-08-11
- Last updated: 2026-08-11

## Goal

Replace the public-site chrome around authenticated `/admin` pages with one consistent admin shell: a full-width bordered header with the Buffet PIN logo at the far left and sign-out at the far right, a white route-aware sidebar with Font Awesome icons, and no footer.

## Current behavior

Every admin route renders its own public `SiteShell`, so authenticated tools inherit the customer navbar and footer. Global admin destinations are repeated as button groups or back links inside several page headers, and page components compensate for the fixed public navbar with large top padding.

## Required behavior

The shared `/admin` layout owns the authenticated header, capability-tailored responsive sidebar, selected-route treatment, skip target, and footer-free page frame. The selected sidebar link uses a faint neutral fill plus a separate left indicator with visible space between the indicator and item surface. Existing page-specific actions, permissions, data operations, and workflow behavior remain unchanged.

## Scope

### In scope

- Shared `/admin` layout and responsive navigation shell
- All existing authenticated admin routes
- Removal of duplicated global admin navigation controls from page headers
- Admin page top spacing after removal of the public fixed navbar
- Browser assertions for shell structure and active navigation

### Out of scope

- Customer, reservation-booking, order-customer, or driver-facing shells
- API, database, provider, permission, audit, or workflow changes
- New admin destinations or production deployment

## Dependencies

- Prior milestones: M0-M10 repository implementation
- External services or credentials: none for code verification
- Business decisions: none
- Manual/hardware gates: authenticated populated-state visual QA remains environment-dependent

## Assumptions

- The login route uses the same bordered logo header but does not show authenticated navigation or sign-out.
- On narrow screens the sidebar becomes an accessible off-canvas drawer so page controls remain usable.
- Existing contextual links that operate within a page remain; repeated global destination links move to the sidebar.

## Expected change surface

### Files and modules

- `app/admin/layout.tsx` and existing admin route entry points
- New shared admin shell component
- Existing admin page headers that duplicate global navigation
- Authenticated browser workflow assertions
- This plan and `docs/launch/IMPLEMENTATION_STATUS.md`

### Database changes

- None.

### API changes

- None. Existing server-side authorization remains authoritative.

### UI changes

- Manager/operator/dispatcher/reporting: dedicated admin header/sidebar and increased content width.
- Login: dedicated logo header without footer.
- Customer/driver: no change.

## Security and privacy

- Sign-out continues to use the existing Supabase browser client.
- Sidebar destinations are filtered to the current staff role while route and API authorization remain server enforced.
- No sensitive data, logging, or audit behavior changes.

## Failure cases and recovery

| Failure | Detection | User/staff impact | Recovery | Automated test |
|---|---|---|---|---|
| Mobile sidebar obscures content | responsive review | controls unavailable | off-canvas drawer, overlay, route-close, Escape handling | browser/manual viewport check |
| Active route is unclear | role/name assertion | navigation errors | `aria-current` plus neutral fill and separate indicator | browser assertion |
| Public chrome remains nested | DOM assertion/code review | duplicate header/footer | remove route-level `SiteShell` wrappers | browser assertion |
| Sign-out moves but stops working | authenticated browser test/manual check | session cannot be ended | retain existing Supabase sign-out flow in shared shell | browser/manual check |

## Implementation sequence

1. Add the shared route-aware admin shell and wire it into `app/admin/layout.tsx`.
2. Remove route-level public shell wrappers and normalize page top spacing.
3. Remove duplicated global admin destination controls while preserving page-specific actions.
4. Add browser assertions and run type, lint, targeted tests, and safe build checks.
5. Review the diff and record verification/status evidence.

## Automated verification

- `npm run lint`: PASS with 0 errors and 28 pre-existing repository warnings.
- `npm run typecheck`: PASS.
- `npm test`: PASS; 216 tests across 20 files.
- `npm run build:safe`: PASS; all 45 application pages generated and the admin routes compiled.
- `npx playwright test tests/browser/authenticated-workflows.spec.ts`: PASS; all 8 authenticated role/workflow tests, including the new shell, active-link, footer absence, and mobile-drawer assertions.
- Browser-computed desktop audit at 1440×900: PASS; 32px logo/sign-out gutters matched the page-content inner gutter, header width 1440px, white 288px sidebar, 1px dividers, active neutral surface with 20px left offset from the separate 3px indicator, zero footer elements, and zero horizontal overflow.
- Browser-computed narrow audit at 390×844: PASS; 64px header plus 1px divider, closed navigation excluded from visibility/accessibility, open 288px drawer, separate active indicator, zero footer elements, and zero horizontal overflow.
- 2026-08-12 uniform-frame follow-up: PASS in local development at 1920×1000 and 390×844. All 16 admin routes now render the same `AdminPage`/`AdminPageHeader` outer contract; the post-sidebar content frame spans its full available width with 32px desktop and 24px mobile gutters. At 1920px the title was at sidebar + 32px, Sign Out ended at viewport − 32px, and horizontal overflow was zero. At 390px the title was at 24px and horizontal overflow was zero.
- 2026-08-12 authenticated Playwright rerun: NOT RUN because the local Docker daemon was unavailable; the web-server bootstrap failed before tests. The new exact gutter assertion compiled successfully through typecheck and the safe production build.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
| Desktop admin shell | local development browser | safe structural preview plus authenticated Chromium workflow | full-width header, persistent white sidebar, aligned equal gutters, clear selected item, no footer | 1440×900 screenshot/computed-style audit and authenticated suite | PASS |
| Narrow admin shell | local development browser | safe structural preview plus authenticated Chromium workflow | accessible drawer and unclipped page content | 390×844 screenshot/computed-style audit and authenticated mobile assertions | PASS |

## Acceptance criteria

- [x] Scoped deliverables implemented.
- [x] Applicable semantic structure, focus treatment, and responsive behavior reviewed.
- [x] Automated checks pass.
- [x] Authorization and audit behavior remain unchanged.
- [x] Documentation and status ledger updated.
- [x] Diff reviewed for correctness, security, concurrency, and missing tests.
- [x] Remaining manual verification explicitly recorded.

## Rollback and deployment considerations

- Presentation-only changes are independently reversible.
- No feature flag, migration, data rollback, deployment, or production mutation is required.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-08-11 | Audited all admin route wrappers, repeated navigation controls, existing page spacing, and the supplied visual reference. | Source review | Shared App Router layout selected as the narrowest consistent ownership boundary. |
| 2026-08-11 | Added the shared header/sidebar shell, removed public shells and repeated global destination controls, and normalized admin page offsets. | Type, lint, unit, safe build, and browser checks passed. | Page-specific actions and the nested driver back link remain contextual; server authorization is unchanged. |
| 2026-08-11 | Aligned both header edges to the page-content gutter and reviewed desktop/narrow layouts. | Exact computed gutters and responsive screenshots passed. | Header uses 24px gutters below `lg` and 32px gutters at `lg`, matching page content. |
| 2026-08-11 | Browser test found the closed mobile drawer remained exposed to visibility tooling; changed the closed state to `visibility: hidden` below `lg`. | Focused shell test and full 8-test authenticated suite passed. | Desktop sidebar remains persistent via the `lg:visible` override. |
| 2026-08-12 | Audited the follow-up gutter/header issue across all admin components. | Source inventory | Found mixed hand-rolled/shared headers and outer widths ranging from `4xl` to `7xl`; standardizing the outer frame while retaining narrower inner forms. |
| 2026-08-12 | Moved every admin title/action row onto `AdminPageHeader` and every page onto the full-width `AdminPage` frame. Removed outer `4xl`/`5xl`/`7xl` differences and the remaining nested-page back-header variant. | Lint, typecheck, 216 Vitest tests, safe build, and responsive local browser audit passed. | The outer page contract is now 24px mobile / 32px desktop; readability constraints belong inside page content, not in the page gutter. |
| 2026-08-12 | Added an authenticated ultra-wide assertion tying title and Sign Out positions to the shared content padding. | Compiled; Docker-dependent execution could not start because Docker was unavailable. | Existing eight-test suite remains historically passing from 2026-08-11; this rerun limitation is explicitly retained. |

## Final handoff

- Files changed: shared admin shell/layout; all admin route wrappers; admin page headers/spacing; authenticated browser workflow; launch plan/status documentation.
- Migrations: none.
- Tests added: authenticated shell assertions for desktop navigation, selected route, sign-out, footer absence, and mobile drawer visibility.
- Commands run: repository lint, TypeScript, Vitest, safe production build, focused/full authenticated Playwright, and local desktop/narrow browser inspection.
- Review findings and resolutions: removed every nested public `SiteShell`; retained only page-specific actions; made the mobile drawer truly hidden while closed; matched header gutters to the content beneath.
- Remaining manual verification: none for the presentation-only shell request; launch provider/hardware/staff gates remain unchanged.
- Known risks: navigation visibility mirrors current route capability boundaries, but server-side route/API authorization remains authoritative. The new authenticated ultra-wide assertion should be rerun when Docker is available.
- Recommended next action: review the shell with the desired real admin account and continue the page-content redesign in a separate scoped task.
