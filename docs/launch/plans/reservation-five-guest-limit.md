# Online reservation guest limit

## Milestone
Scoped reservation policy update; CODE_COMPLETE; 2026-09-10. Branch `codex/reservation-five-guest-limit`, isolated at `/Users/daniel/buffet-pin-reservation-limit` from deployed main commit `c69a427`. Production baseline: READY Vercel `dpl_BPhPw6DJPQEGvvbBaxzZPcPEUutq`.

## Goal / current and required behavior
Existing public form offers 6–15 guests. Change existing options to 1–5 and existing French/English copy to require a call for 6+. Add no UI elements or layout changes. Enforce the same rule in public availability, creation and booking edits. Production's persisted booking switch is currently false and stays unchanged.

## Scope / assumptions
Only this policy, relevant tests and documentation. Shared persisted min/max settings currently also govern staff reservations; keep staff rules separate so larger phone bookings remain possible without a database mutation. Preserve larger existing reservations, contact edits and cancellation; changing their date/time or guest count to another size above five requires a call. Reductions to 1–5 are permitted subject to existing rules. Staff can also create and edit the new 1–5-person bookings; configured larger-party bounds remain in force. Existing cutoff/capacity/closure rules still apply. Default public selection is two guests. Production publication requires explicit authorization under AGENTS.md; prepare and verify the concrete release first.

## Expected change surface
Existing reservation form, guest-management controls, English/French copy, public rules/availability/update route, staff creation's shared-rule import, one public party-size policy module, tests and launch documentation. No schema, migrations, dependencies, assets, ordering, payment, switch behavior or settings data changes.

## Security and privacy
Public handlers enforce the limit independently of browser choices and persisted staff bounds. Existing auth, transaction locks, notifications and cancellation behavior remain. Tests use only disposable local PostgreSQL and mocked SMS; no real bookings or customer data.

## Failure cases and recovery
- Stale/forged 6+ requests: reject with INVALID_PARTY_SIZE and phone guidance.
- Old 6–15 settings: public 1–5 policy remains effective without reseeding.
- Historical larger booking: preserve its real selected value; permit contact edits/cancellation, disallow rescheduling at 6+.
- Disabled switch: existing closed page and 503 guards remain.

## Implementation sequence
1. Confirm production baseline; isolate checkout and document scope.
2. Change existing choices/copy and server policy; preserve staff/historical paths.
3. Run policy/route tests, disposable DB/API and desktop/mobile browser coverage, typecheck, focused noninteractive lint and safe production build.
4. Review full diff against deployed commit, record evidence and prepare the release.

## Migration compatibility
No migration or production database changes. Existing records/settings stay byte-for-byte untouched by this patch. Existing deployment migrations must remain unchanged.

## Acceptance criteria
1–5 allowed when enabled and capacity exists; 6+ rejected in public availability/create and booking edits; staff larger bookings and historical contact edits/cancellation work; existing controls/copy only, both languages and mobile/desktop; booking switch stays unchanged; checks pass and diff contains only this change.

## Verification / remaining gates
- Clean dependency install from the deployed lock: PASS; dependency versions/lock unchanged.
- Node 22.23.2 `npm run test:reservations`: PASS, 30 tests (existing switch and 21 policy cases).
- Node 22.23.2 `npm run test:reservations:db`: PASS, nine tests on disposable PostgreSQL at 127.0.0.1:55439. Real route handlers cover availability/create at one/five, rejection at six/fifteen without rows or SMS, public edit boundary, staff creation at six and edit at seven, staff small-party editing, historical contact edits, reschedule rejection, cancellation and reduction to five. Historical sentinel and all prior settings fields are compared after cleanup.
- `npm run test:reservations:browser`: PASS, four Chromium workflows, including both existing switch workflows. Public options and French/English guidance verified at 1440px and 390px; historical eight-person booking retains its real selected value, contact/cancel controls and restricted date/time controls. Existing media-load assertions still pass.
- `npx tsc --noEmit --incremental false`: PASS.
- Focused noninteractive ESLint via the original repository's existing config/toolchain: PASS, zero errors; two existing warnings (manage effect dependency and unused resetForm).
- Safe production build: PASS with `scripts/build-reservation-safe.mjs`, explicit non-production values, no production secrets or database access; 23 static pages generated.
- Visual review: French mobile, English desktop and historical management mobile screenshots pass. Evidence is in ignored `.vercel/party-size-*.png`; build log in `.vercel/party-size-build.log`.
- Exact deployment source independently verified through Vercel deployment API: gitSource.sha is `c69a4272fd9021838372b4badb0f44141a8cb1da`, matching this branch's parent.
- Final diff reviewed for server bypasses, staff/shared-rule regressions, historical records, transaction/capacity behavior, UI scope, secrets and documentation. No dependency, migration, asset, switch or ordering code changes.

Production deployment/live smoke remain NOT_RUN pending explicit publishing authorization. Production availability is still false; do not enable it as part of publishing this policy.

Tests use Node 22.23.2: the host's default Node 23.3.0 cannot load the existing Vitest CommonJS config with its ESM dependency. No dependency or config upgrade is included. Database/browser setup uses the existing `reservation-settings-switch.md` procedure and disposable sentinel, never `.env` or production data. The two database files run serially because the existing switch suite verifies a single preserved sentinel.

## Rollback
Revert this isolated application patch; no database rollback required. Keep the persisted availability flag unchanged.
