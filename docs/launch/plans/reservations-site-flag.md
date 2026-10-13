# Reservation availability flag

## Milestone
- Number/name: Scoped public-site follow-up (no delivery milestone expansion).
- Status: CODE_COMPLETE
- Branch: codex/admin-drinks-page (preserve existing worktree changes).
- Owner: Codex
- Started / last updated: 2026-09-09

## Goal and required behavior
A single shared flag disables new online reservations, hides public booking links, and shows a large bilingual call-to-reserve message and tappable (450) 699-8088 number at /reservation instead of the form.

## Current behavior
Navbar (four desktop/mobile variants), HeroSection, and CtaStrip link to /reservation. The page renders ReservationForm and the creation/availability POST handlers accept requests independently of the UI.

## Scope and dependencies
Public booking entry points only. Existing guest management/cancellation, admin tools, reservation reminders, and delivery ordering remain available. No external credentials or business choices are needed. Existing uncommitted changes must be preserved.

## Assumptions
Use a source-controlled, client-safe RESERVATIONS_ENABLED boolean, initially false. Changing it requires rebuilding/redeploying so browser and server share the same setting. Preserve management of existing reservations.

## Expected change surface
- Shared flag; reservation page; booking/availability APIs; navbar and homepage CTAs; bilingual call message and page metadata.
- No database changes, migration, backfill, or data rollback needed.
- Disabled POST endpoints return 503 / RESERVATIONS_DISABLED before parsing, rate limiting, database access, or provider side effects. Existing authorization and request rules apply when enabled.
- No credentials or customer data added; direct API submission cannot bypass the UI closure. No reservation transition occurs while blocked, so no new audit event is needed.

## Failure cases and recovery
| Failure | Detection / impact | Recovery | Automated test |
|---|---|---|---|
| Stale client submits booking | Explicit 503; no booking created | Return to home; reopen only by flag change | Route tests |
| Direct page visit | Call message instead of form | Re-enable flag and rebuild | Page/browser tests |

## Implementation sequence
1. Add central flag and guard UI/page/API/discovery.
2. Test enabled/disabled behavior and browser entry points.
3. Run typecheck, lint, relevant tests, safe build; review diff and update ledger.

## Automated verification
- `npm test`: exit 0; 234 tests across 25 files, including four new route tests covering disabled side-effect prevention and enabled normal validation.
- `npm run typecheck`: exit 0.
- `npm run lint -- --quiet`: exit 0; zero errors.
- `npx playwright test tests/browser/reservations-disabled.spec.ts`: exit 0; four Chromium tests covering HTTP 200 call page, language toggle, phone link, absent form, hidden desktop/mobile links, and blocked direct submissions.
- `npm run build:safe`: exit 0; optimized production build and built-in typecheck pass; pre-existing lint warnings remain.
- `git diff --check`: exit 0.
- Local visual review: 390×844 and 1440×1000 screenshots show large, readable call message and number with no clipping. Evidence: `/tmp/buffet-pin-reservations-review/mobile.png` and `/tmp/buffet-pin-reservations-review/desktop.png`.
- Reviewed scoped diff for flag consistency, early API guards, preserved existing work, and missing entry points. No concurrency/database changes.

## Manual verification
Production deployment/browser smoke: NOT_RUN, outside requested local implementation. No hardware/provider gates introduced.

## Acceptance criteria
- Shared flag defaults disabled and all public booking buttons disappear.
- Direct page access shows the call message without rendering a form; direct submissions fail without side effects.
- Enabled branches retain existing behavior.
- Relevant checks pass, diff reviewed, documentation and ledger updated.

## Rollback and deployment
Set RESERVATIONS_ENABLED to true in lib/site-flags.ts and rebuild/redeploy to restore booking. No deployment is authorized or performed here.

## Progress log
- 2026-09-09: Inspected pre-existing worktree, reservation routes, public CTAs, test tooling, and launch guidance. Implementation started.

## Final handoff
Shared flag, public page/call component, translated copy, navbar/hero/CTA guards, two API guards, route/browser tests, decision record, and ledger are complete. Existing management and cancellation flows remain accessible. No migrations or production mutations. Production smoke is not run; restore online booking by setting the shared flag to true and rebuilding/redeploying.

- 2026-09-09: User replaced the redirect requirement with a short, large call-to-reserve message. Existing sitemap/restaurant structured data remain valid for telephone reservations.
