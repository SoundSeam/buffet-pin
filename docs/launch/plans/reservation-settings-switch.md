# Reservation settings switch

## Milestone
- Scoped reservation-only follow-up; VERIFIED; 2026-09-09.
- Branch: codex/reservation-settings-switch, based on origin/main 45edfa2.
- Owner: Codex. Existing unrelated work remains in the original checkout.

## Goal / current and required behavior
Main currently accepts online reservations and advertises public booking buttons. Add a persistent onlineReservationsEnabled setting, initially false, controlled by a switch in existing reservation settings. When off, hide booking links and show a large bilingual call message with a telephone link instead of the form. Keep existing management/cancellation available.

## Scope / assumptions / dependencies
Only reservation availability, associated UI, API guards, authorization/audit, additive migration, tests and documentation. No delivery milestone work or unrelated assets/styles/dependencies. User authorized production deployment and additive database changes that preserve data. Use the existing Vercel project and current main, and verify the database migration history before applying only this new migration.

## Expected change surface
Settings gains one default-false Boolean. ReservationAvailabilityEvent records changed value, previous value, actor ID and timestamp; no update/delete API. Existing reservation and other domain tables are unchanged. A settings row lock orders availability changes against booking transactions. Existing settings PATCH and admin authentication protect the switch. Repeated saves of the same flag do not create duplicate events. Server-rendered public availability is read per request, fails closed, and client navigation/focus refreshes it.

## Security and privacy
No credentials enter source or client; public status exposes only a Boolean. Test data uses disposable local PostgreSQL. Production verification uses aggregate counts/digests rather than printing customer records. Existing reservations are never deleted, rewritten, or seeded.

## Failure cases and recovery
| Failure | Detection and impact | Recovery / test |
|---|---|---|
| Read unavailable | Public UI and APIs fail closed | Restore DB; failure test |
| Booking races disabling | Lock plus authoritative transaction check | Race/integration test |
| Stale browser form | Server rejects booking after switch-off | API/browser test |
| Unauthorized switch change | 401, no write | Route test |
| Audit insert fails | Entire settings transaction rolls back | Database test |

## Implementation sequence
1. Build narrowly on main; add flag, audited switch, server gates and bilingual call message.
2. Test migration on disposable PostgreSQL containing sentinel reservation data, both flag states, API auth, concurrency and UI.
3. Run typecheck, focused lint/tests, production build; review scoped diff.
4. Confirm production database target/history, preserve baseline row evidence, deploy exact source with only additive migration, verify data and live site.
5. Update status and handoff.

## Automated verification
- Clean `npm ci`: PASS after correcting the development-test dependency lock with npm 11. Existing production dependency versions are unchanged.
- `npm run test:reservations`: PASS, nine read/route/authorization/validation tests.
- `npm run test:reservations:db`: PASS, four PostgreSQL tests for preservation, audited changes, concurrent repeats, rollback, and booking/disable ordering.
- `npm run test:reservations:browser`: PASS, two Chromium workflows including desktop/mobile/public management-error links and authenticated switch discard/save/reload/enable/disable; slot capacities stay unchanged.
- `npx tsc --noEmit --incremental false`: PASS.
- Focused ESLint using the available repository toolchain: PASS, zero errors.
- `node scripts/build-reservation-safe.mjs`: PASS on final release source after the clean install.
- Disposable migration: prior main migrations applied, sentinel inserted, new migration applied, then repeated deploy had no pending migrations. Before/after reservation digest remained `7c2bee31c823d7fe4ccad842d98623c4`.
- All ten main migration checksums match the configured live database, which already has 31 applied migrations. Only the new additive migration is pending in this release; no existing migration file is modified.
- Private reservation/settings backup restored into a separate local database: all 312 reservation records match pre-migration fingerprints exactly. Backup and PII-free baseline are kept in ignored `.vercel/` files, never committed or uploaded.
- Diff reviewed: no reservation-table or existing-row migration, unrelated asset/style/ordering changes, secrets, or destructive SQL.

## Manual verification
Local desktop/mobile and authenticated settings-switch visual review complete. Production HTTP/browser smoke complete; no Clover, payment, hardware or real reservation submission is part of this task. The first main-based deployment regressed the previously deployed image fix, which was absent from main. The user identified this; the existing CloudFront asset mapping is now being restored as an explicit scope correction.

## Acceptance criteria
- Persistent default-off switch saves in reservation settings with authenticated audit evidence.
- Disabled links/form/API behavior and enabled restoration pass.
- Existing reservation data unchanged by migration, and repeated migration deployment is safe.
- Relevant checks pass; exact isolated diff reviewed; production deployed and smoke verified.

## Rollback
Switch on to restore online booking, off to disable; no rebuild needed. Do not drop the added column/event table on rollback. Code rollback to pre-switch main restores old behavior (including online booking); use the new settings switch to keep reservations closed. Schema changes are additive and backward-compatible. No data migration or destructive command.

## Progress log / final handoff
2026-09-09: Created isolated worktree from latest main. User approval covers deployment and data-preserving schema alteration. Implementation in progress.


## Reproducing database/browser checks
Use a disposable PostgreSQL instance on `127.0.0.1:55439`, database `reservation_switch_test`, role `reservation_test`; tests hard-code this address and never consume production credentials. Apply main migrations first, insert a synthetic reservation with ID `availability-sentinel`, guest name `Preserved Test Guest`, party size 6, and a Settings row with ID 1; then apply this additive migration. Run the database and browser suites sequentially. The browser harness serves a local Supabase fake on port 55440 and the real Next app on 3111, with no provider secrets. Database suite resets only the test availability switch at setup, preserves the sentinel, and leaves booking disabled. The browser suite checks both switch states and also leaves it disabled. Unit tests require no database.


## Production handoff — 2026-09-09
- Feature commit `bdc585801ab1b59427977b68d02c46bed7ceb127` fast-forwarded main from `45edfa2`; only the reservation feature and its test/documentation support were included.
- Vercel production deployment `dpl_DDABEwtqf5bRjo3Uzs891d3s3XiK` is READY and serves `https://www.buffetpin.com` (plus existing aliases).
- Build applied only `20260910020000_reservation_availability_switch`; all prior migration files were preserved. No schema push/reset/drop or seed was run against production.
- Before/after database verification: 312 reservations, zero missing, zero changed fingerprints; old settings fields, slot capacities, and closure dates unchanged. New flag is false and audit table is empty, as expected for migration initialization without staff actions.
- Production smoke: status reports false; both booking POST endpoints return 503 / RESERVATIONS_DISABLED; unauthenticated settings PATCH returns 401. Desktop/mobile home and booking pages have no booking links; booking page has large French/English call copy and the correct telephone link.
- Switch location: `/admin/settings`, “Réservations en ligne” / “Online reservations”; use the existing Save button. Enabling restores booking without a deployment; disabling preserves existing guest management/cancellation.
- Private backup and matching baseline/after evidence are retained under ignored `.vercel/` in the isolated worktree. Backup restore matched every reservation record. No secrets or customer records are committed.
- This final documentation update records evidence from the deployed feature source; it contains no application or migration changes.


## Image correction
User steering requires preserving the prior image fix. Restore only the eight existing CloudFront mappings and associated consumers, without unrelated ordering work. Add loaded-image browser assertions, verify all eight remote assets, rerun browser/build checks, and deploy on main. No database changes or production settings mutations are required.


Image correction outcome: `ba6ca3a` is deployed on the production domain through `dpl_TNnFf1XRbzsTyfz41agvuWYJjqQU`. The prior live deployment was inspected using authenticated Vercel access and confirmed to use the same restored CloudFront URLs. All eight CDN assets return 200 and match the existing dedicated bucket's object ETags and sizes. Both buckets remain fully blocked from public S3 access; no infrastructure mutation is necessary or performed. Loaded-image browser assertions, media manifest test, focused lint, and safe production build pass. Live homepage images/video and reservation-page images are loaded, with booking still off.


## Toggle alignment follow-up — 2026-09-10
Scope: only the reservation settings switch geometry. The global 44px minimum button height stretched a nominally 32px track while its 24px thumb stayed top-aligned. Keep a 44px clickable button, center a separate 56×32px visual track, and give the 24px thumb an even 4px inset in either state. Preserve switch semantics, saving behavior, flag state, database schema/data, and the working CloudFront assets. No migration. Verify measured geometry and screenshots for both states at desktop/mobile widths, run existing browser coverage, TypeScript/lint and a safe build, then deploy only this UI change on main. Rollback reverts this component-only markup/style change.


Toggle alignment verification: PASS at 1440px and 390px in both states. Measured 56×32px track, 24×24px thumb, even 4px inset, and 44px button height (track centered with 6px above/below). Space-key activation works. Four focused screenshots were captured under ignored `.vercel/toggle-*.png` and visually reviewed. Both existing Chromium workflows pass; focused ESLint, `git diff --check`, and the safe production build including type validation pass. The release changes only `components/admin/admin-settings-page.tsx` plus this documentation; no scripts, assets, behavior, dependencies, schema, or migrations are changed. The live reservation setting was false before deployment.
