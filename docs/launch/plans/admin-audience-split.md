# Admin, reports, and developer audience split

## Milestone

- Number and name: Post-M11 audience architecture correction
- Status: `MANUAL_VERIFICATION_REQUIRED`
- Branch: current user worktree
- Owner: Codex
- Started: 2026-08-13
- Last updated: 2026-08-13

## Goal

Make `/admin` a restaurant-operations product, create a calm read-only financial paper trail at `/reports`, and isolate provider diagnostics and recovery at `/dev` without weakening any payment, print, refund, catalog, dispatch, reconciliation, or audit invariant.

## Current behavior

The preceding reduction placed restaurant work, Clover mapping, recovery, reconciliation, and machine testing inside broad admin workspaces. That reduced page count but mixed three audiences and exposed technical states to restaurant users.

## Required behavior

- `/admin`: Orders, Kitchen, Dispatch, Drivers, Reservations, Menu, and Settings, capability-filtered and expressed in restaurant language.
- `/reports`: read-only Overview, Daily, Monthly, Orders, Refunds, and CSV exports for `REPORTING_READ` users.
- `/dev`: System health, Problems and recovery, Clover menu connection, Money comparison, Clover and printer test, and Audit history for explicit `DEV_TOOLS` users.
- Legacy browser routes redirect to the correct audience area.

## Scope

### In scope

- Audience-specific shells, route composition, copy, authorization, redirects, reports, exports, technical health evidence, and automated assertions.
- A restaurant-facing Needs attention view with plain consequences and guided printer questions.
- Additive `TECHNICAL` staff role and `DEV_TOOLS` capability.

### Out of scope

- Provider contract changes, real Clover calls, physical printer testing, production deployment, public-ordering changes, real refunds, and deletion of safety infrastructure.

## Dependencies

- Prior milestones: M0–M11 and the admin surface reduction.
- External services or credentials: none for repository verification.
- Business decisions: the user explicitly supplied the three-audience product architecture.
- Manual/hardware gates: restaurant tablet/staff usability, Docker-backed populated browser execution, Clover, printer, Twilio, and production evidence remain open.

## Assumptions

- `TECHNICAL` is a separately assigned role and does not inherit manager refund or business-decision authority.
- Managers retain `REPORTING_READ` and therefore can return between restaurant operations and reports.
- Technical users may inspect refund recovery state but cannot submit or resolve a refund without `REFUND_WRITE`.

## Expected change surface

### Files and modules

- Audience shells/navigation, restaurant home/attention/driver views, financial reports/exports, protected technical health/audit pages, retained diagnostic components, authorization helpers/APIs, tests, and launch records.

### Database changes

- Add `TECHNICAL` to `StaffRole` using an additive PostgreSQL enum migration.
- No backfill and no existing staff assignment changes.
- Rollback is application-level removal of assignments/navigation; the enum value is intentionally not destructively removed.

### API changes

- Existing `/api/admin/*` names remain stable.
- Diagnostic GET/recovery routes accept either their existing manager capability or `DEV_TOOLS` where appropriate.
- Refund submission/resolution remains `REFUND_WRITE`; reporting exports require `REPORTING_READ`.
- No idempotency, provider, mutation, or audit contract is changed.

### UI changes

- Restaurant: direct operational pages and plain Needs attention guidance; no Clover IDs or raw evidence.
- Reporting: calm daily/monthly totals, unresolved differences, records, refunds, and safe CSV downloads.
- Developer: evidence-backed health, provider diagnostics, recovery, technical reconciliation, machine test, and audit history.

## Security and privacy

- Every retained page performs a server-side capability check; navigation filtering is only presentation.
- Reporting pages and exports are read-only and require `REPORTING_READ`.
- Developer pages require `DEV_TOOLS`; managers do not receive it automatically.
- Technical access does not grant refund, settings, staff, production, or dispatch authority.
- No raw card data is queried, displayed, or exported.

## Failure cases and recovery

| Failure                                     | Detection                          | User/staff impact            | Recovery                                       | Automated test             |
| ------------------------------------------- | ---------------------------------- | ---------------------------- | ---------------------------------------------- | -------------------------- |
| Old bookmark opens wrong audience           | redirect mapping/browser assertion | tool appears missing         | stable server redirect                         | unit + browser spec        |
| Reporting user reaches a mutation           | server capability denial           | unauthorized business change | deny and retain state                          | capability + browser spec  |
| Technical user gains refund authority       | server capability denial           | unauthorized money decision  | require separate manager actor                 | staff-policy test          |
| Missing provider evidence appears green     | evidence endpoint/UI state         | misleading readiness         | show unknown until affirmative evidence        | type/build + source review |
| Restaurant alert exposes provider internals | UI review/browser assertion        | operational confusion        | translate consequences; keep details in `/dev` | browser spec               |

## Implementation sequence

1. Inventory routes, links, capabilities, APIs, components, and tests.
2. Add explicit technical authorization and audience shells.
3. Restore direct restaurant workflows and add plain Needs attention.
4. Add read-only reports and exports.
5. Relocate and redesign technical tools without changing coordinators.
6. Update redirects, tests, migration, and launch records.
7. Run lint, typecheck, tests, Prisma validation, safe build, and browser verification where available.

## Automated verification

- Targeted ESLint: PASS with no errors.
- `npm run typecheck`: PASS.
- `npm test`: PASS; 226 tests across 22 files.
- `npx prisma validate`: PASS.
- `npm run build:safe`: PASS; 58 application pages generated.
- Authenticated Playwright: NOT RUN; the test server stopped before execution because the local Docker daemon was unavailable.

## Manual verification

| Test                | Environment               | Preconditions                                        | Expected result                                            | Evidence | Status  |
| ------------------- | ------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- | -------- | ------- |
| Restaurant workflow | restaurant tablet/browser | seeded manager/operator/dispatcher                   | direct touch-friendly workflow and no provider internals   | pending  | NOT_RUN |
| Reports paper trail | owner/bookkeeper browser  | representative paid/refunded orders and Clover close | totals, comparison, exceptions, and CSV are understandable | pending  | NOT_RUN |
| Developer recovery  | technical browser         | seeded unknown/failure states                        | detailed evidence and safe controls remain available       | pending  | NOT_RUN |

## Acceptance criteria

- [x] Three audience route families and server capability boundaries implemented.
- [x] Restaurant routes and Drivers remain under `/admin`.
- [x] Read-only financial pages and exports implemented.
- [x] Technical tools relocated without deleting recovery infrastructure.
- [x] Required legacy redirect mapping implemented.
- [x] Non-browser automated checks pass.
- [ ] Authenticated browser suite passes with Docker available.
- [ ] Restaurant staff usability is verified on the intended device.
- [x] Documentation and status ledger updated.

## Rollback and deployment considerations

- Feature flags: none.
- Backward compatibility: required legacy URLs redirect; internal APIs retain their names.
- Data rollback limitations: the additive enum value is harmless if unused and is not destructively removed.
- Operational rollback: restore previous route composition while leaving the additive role value dormant.

## Progress log

| Date       | Change                                                                                                                                                     | Verification                                                                                   | Decision/blocker                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 2026-08-13 | Inventoried current admin routes, APIs, links, capabilities, and tests.                                                                                    | Source review                                                                                  | Preserve durable safety coordinators and internal API names.                                         |
| 2026-08-13 | Implemented restaurant, reporting, and developer products plus additive technical authorization.                                                           | Typecheck, targeted lint, unit tests, Prisma validation, safe build                            | No production/provider mutation.                                                                     |
| 2026-08-13 | Updated authenticated browser scenarios and attempted execution.                                                                                           | Server stopped before test bodies                                                              | Docker daemon unavailable.                                                                           |
| 2026-08-13 | Made the desktop sidebar column stretch to the content bottom and kept only its navigation block sticky. Mobile remains a scrollable drawer.               | Targeted lint, typecheck, unit tests, safe build; authenticated edge assertion added           | Removes the nested desktop scroll surface without changing routes or permissions.                    |
| 2026-08-13 | Replaced the sticky flex shell with fixed application chrome: one fixed header, one fixed viewport-height rail, and one document-scrolling content column. | Desktop viewport-coverage and zero-overflow assertions added; mobile drawer assertion retained | The rail background now belongs to the viewport shell instead of inheriting document/content height. |

## Final handoff

- Files changed: audience routes/layouts/navigation, restaurant home/attention/driver views, financial reports/exports, technical health/audit pages, diagnostic copy, authorization helpers/APIs, migration, tests, and launch records.
- Migrations: additive `20260813140000_add_technical_staff_role`.
- Tests added: technical capability isolation, audience landing, required redirect mapping, and updated authenticated audience/browser assertions.
- Commands run: Prettier/Prisma format, Prisma generate/validate, targeted ESLint, TypeScript, Vitest, safe build, attempted Playwright.
- Remaining manual verification: populated authenticated browser suite and real restaurant/owner/technical usability reviews.
- Known risks: reports are limited to retained local and imported sanitized Clover evidence; absence of a current import is shown as unknown, not healthy.
- Recommended next action: run the authenticated suite with Docker available, then conduct role-specific tablet review before deployment.
