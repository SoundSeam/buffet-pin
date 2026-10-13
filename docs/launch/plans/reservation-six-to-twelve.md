# Online reservations for groups of 6–12

## Milestone
VERIFIED; 2026-09-15; branch `codex/reservation-six-to-twelve`; isolated checkout `/Users/daniel/buffet-pin-reservation-six-to-twelve`.

## Goal / current and required behavior
Change the existing online reservation range from 1–5 to 6–12, default six. Reuse existing controls, layout and bilingual guidance; outside this range guests call (450) 699-8088. User explicitly authorized deploying only this change. Exact live baseline confirmed through Vercel: `0a09ad0d54db781634e4bc50b9f53f7f9e84fc61`, READY `dpl_4MkG3ZXyZNwDYFMHcD2UAe6ZgC2F`. Live booking switch is now true and remains unchanged.

## Scope / assumptions / dependencies
Reservation policy constants, existing bilingual copy, guest management boundary handling, focused regression tests, documentation. Preserve all recent drinks/image work by basing on exact live main. Preserve staff capabilities and existing reservations, including prior 1–5 bookings. Existing bookings outside the new range retain contact editing/cancellation; scheduling/party-size changes must result in 6–12 or be handled by phone. Keep current service-fee notice, hours, capacity, cutoff, closure and switch behavior. No new UI elements.

## Database / API / security compatibility
No schema, migration, seed, dependency or production-data changes. Public create/availability/update enforce both bounds independently of persisted staff limits. Staff retain support for small historical parties and configured larger phone parties. Normal tests use a disposable local database and mock SMS. Production verification uses read-only pages and availability requests, never real booking submissions or staff mutations.

## Failure cases and recovery
Reject forged/stale requests for 1–5 or 13+ with phone guidance. Preserve real selected values for historical small/large bookings rather than silently changing them. Failed builds prevent release. Production switch stays unchanged. Rollback to baseline deployment requires no database rollback.

## Implementation / verification sequence
1. Isolate exact production source and record scope.
2. Change policy, existing copy and both management bounds.
3. Verify six/twelve success, five/thirteen denial, historical small/large contact edits and cancellation, staff edits and capacity. Test desktop/mobile in both languages; run typecheck, focused lint and safe build.
4. Review exact diff, fast-forward main with only this change, await Vercel READY and verify live forms/availability/media/switch.
5. Record deployment evidence and update status ledger.

## Acceptance criteria
Online options exactly 6–12 with six selected initially; public API rejects both adjacent boundaries; existing layout only; staff/historical records preserved; all relevant checks pass; exact reviewed commit deployed on top of live source; booking switch unchanged and recent drinks assets intact.

## Verification and remaining gates
Automated verification passed using Node 22.23.2: 39 unit/route tests, 11 disposable PostgreSQL/API tests and five Chromium workflows. Browser checks cover 390px/1440px, French/English, default six and exact 6–12 options, historical parties of four/fifteen, and both booking-switch states. TypeScript and focused noninteractive ESLint pass (zero errors, one pre-existing effect-dependency warning). Safe production build passes with 23 static pages. Mobile French and desktop English screenshots reviewed; existing service-fee notice preserved. Evidence: ignored `.vercel/party-size-*.png` and `.vercel/range-build.log`.

Review confirms no changes to schema/migrations, dependencies/lock, deployment config, drinks code/assets, ordering, or booking-switch logic. Only the policy, existing copy/management bounds and relevant tests/docs differ from live `0a09ad0`. Deployment and live verification completed after explicit authorization. No new provider gate; no real booking/SMS test is needed.

## Rollback
Prior READY deployment `dpl_4MkG3ZXyZNwDYFMHcD2UAe6ZgC2F`, commit `0a09ad0`. Revert only this scoped change if needed, preserving the availability switch and database.


## Deployment evidence — 2026-09-15

Main fast-forwarded from exact live baseline `0a09ad0` to feature commit `018c4b148b99bb14c5a8436eb2c7d500e091a080`. Vercel deployment `dpl_PPumgdsTUYdwdpgsLXJ6w9QGmuck` is READY and serves `https://www.buffetpin.com`; both the domain inspection and deployment gitSource confirm the exact reviewed release. Production build passed and reported **No pending migrations to apply**.

Live Chromium verification passed at 1440px and 390px: exact seven choices (6–12), default six, French/English guidance, loaded CDN logos and no horizontal overflow. Live availability returned HTTP 200 for six/twelve, HTTP 400/INVALID_PARTY_SIZE for five/thirteen. Booking status remains true. Existing drinks page and CDN images load. No real booking was submitted and no staff/settings mutation was performed. PII-free check output and screenshots are retained in ignored `.vercel/live-range-*`; production build log is `.vercel/production-range-build.log`.

All scoped work is verified. Final evidence is committed locally as documentation only to avoid triggering a redundant production deployment. No ordering, drinks, media, schema, dependency or deployment-config changes were included.
