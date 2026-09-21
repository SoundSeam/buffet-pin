# Restore July reservation behavior with maximum twelve

## Milestone
VERIFIED; 2026-09-20; branch `codex/restore-july-reservation-behavior`, isolated from exact live `82bbb31`. User explicitly authorizes publishing the functional July restoration with 15 changed to 12.

## Findings / required behavior
July reference `45edfa2` used one shared configured min/max rule for public/staff creation and updates. Recent patches instead imposed a fixed public range, let staff bypass the configured minimum, and allowed some outside-range guest edits while disabling scheduling controls. The previous copy-only release did not restore these functions. Current stored Settings: min 6, max 15, capacity 24, firstSlot 16:30, lastSlot 20:00, interval 30 minutes, modification cutoff 24 hours, online enabled. These match July defaults except the newly requested maximum must now become 12.

## Scope
Restore original form choices 6–12/default six, shared settings-based rules/routes and original guest-management controls from pre-range-change `c69a427` (matches July except existing switch guards). Keep the current enabled switch, current copy (July with guest limit 12), and unrelated media/drinks/ordering. Remove the obsolete independent policy helper. Update creation defaults/seed maximum to twelve; never run the general seed against production.

## Database compatibility / audit / rollback
A new versioned, guarded migration changes only Settings.id=1.maxPartySize from 15 to 12 and its updatedAt timestamp. Row lock prevents concurrent settings overwrite during migration; unexpected min/max aborts rather than overwriting staff customization. Existing 6–12 state is a no-op; missing settings use the new default. No schema changes or historical reservation writes. Migration history, authored release, explicit user instruction, and before/after PII-free fingerprints provide deployment audit evidence. Verify existing migration checksums before release and compare protected row fingerprints afterwards.
Rollback: redeploy prior `82bbb31` (which independently enforces public 6–12); database maximum 12 is compatible. Restoring the exact previous staff maximum requires an explicit recorded Settings change back to 15, not a database reset. No reservations are removed on either path.

## Verification
PASS: exact source comparison of seven restored files against pre-range `c69a427`, changing only the two guest-choice arrays to end at twelve. Those files match July except preserved booking-switch guards. Settings defaults/seed match July except max 12; time, slots, capacity and validation source match July byte-for-byte.

PASS: 34 unit/route tests, 12 disposable PostgreSQL/API tests and five mobile/desktop Chromium workflows. Shared settings changes are enforced equally for staff/public; 5/13 invalid creates/edits reject; original valid editing/cancellation works; outside-range historical records remain readable/cancellable and rejected edits do not mutate them. Original guest-edit controls and service-fee notices visually reviewed. TypeScript, focused lint (zero errors/two existing warnings), diff check and safe production build pass.

PASS: migration changes only maximum/timestamp, preserves sentinel reservation/all other settings, replays without changes, and rejects custom bounds without overwriting them. Existing 12 repository migration checksums match production history; only the new guarded correction is pending. PII-free baseline captures 327 reservation fingerprints and settings/capacity/closure/drinks/order-settings digests. Evidence is retained under ignored `.vercel/` (including migration exercise and before/after capture scripts). Live deployment and preservation verification pass. Normal tests use only disposable local PostgreSQL at 127.0.0.1:55459; prior test port 55439 is occupied by Docker. SMS is mocked. Verify current live database target through known working project credentials and deployed public settings behavior; production env pulls mask sensitive values. No credentials/PII are printed, committed or uploaded.

## Acceptance
Current reservation policy behaves like July with max 12: both staff/public use configured bounds, invalid edits reject, original edit controls/notices restored, 6/12 accepted and 5/13 denied, source defaults and live stored maximum agree. Existing hours/capacity/cutoff/switch/records and unrelated site features remain. Publish only this scoped change and record exact deployment evidence.


## Production deployment and preservation — 2026-09-20
After explicit user authorization, main fast-forwarded `82bbb31` → `c874e11765053c75d4278aaf3fbed90e00f655d7`. READY Vercel `dpl_FnmZX1EeGPgeiGZcDRxeaLnnQK9e` serves `https://www.buffetpin.com`; live-domain and deployment gitSource checks confirm this exact commit. Vercel applied only `20260921003000_restore_reservation_max_party_size`, then built successfully.

Production Settings now has minPartySize=6, maxPartySize=12 and onlineReservationsEnabled=true. Apart from the intended maximum and updatedAt, every Settings field matches before deployment. All 327 existing reservation row fingerprints match exactly; slot capacities, closures, drinks categories/items and ordering settings count/digests are unchanged. All shared migration checksums match and the new migration is recorded complete. Evidence is PII-free, stored in ignored `.vercel/production-before.json` and `production-after.json`.

Live Chromium checks pass at 1440px and 390px: exact 6–12 choices/default six, historical wording with guest limit twelve, loaded logos and no overflow. Availability six/twelve returns 200; five/thirteen returns the restored settings-based 400/INVALID_PARTY_SIZE and message "Party size must be between 6 and 12." Booking remains enabled. Existing drinks/CDN images load. No real booking or staff mutation was submitted for verification; only the authorized migration changed the intended production setting.

All scoped acceptance checks are satisfied. Original July behavior is restored with the maximum changed to twelve; the newer availability-switch feature is intentionally retained. Final documentation evidence is committed locally without triggering a redundant production build.
