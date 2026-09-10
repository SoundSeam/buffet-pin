# Implementation status

## Reservation settings switch — 2026-09-09

`VERIFIED` for this scoped reservation change; deployed to production from main on 2026-09-09 (America/Montreal). Scoped change on top of main only. Settings now persists `onlineReservationsEnabled` (default false); authenticated administrator changes record previous/new values, actor and timestamp transactionally. Disabled booking hides public links, displays the bilingual call message, and blocks direct submissions. Existing management/cancellation and data remain intact.

Verification: clean npm install, nine route/unit tests, four disposable PostgreSQL tests, two desktop/mobile/authenticated Chromium workflows, TypeScript, focused lint, safe production build, additive migration/replay, and a backup restore matching all 312 live reservation fingerprints. See `plans/reservation-settings-switch.md` for evidence, rollback, remaining production checks and test setup. Unrelated delivery-launch work in the original checkout is excluded.


Production evidence: feature commit `bdc585801ab1b59427977b68d02c46bed7ceb127`, Vercel deployment `dpl_DDABEwtqf5bRjo3Uzs891d3s3XiK`, live at `https://www.buffetpin.com`. The new migration applied successfully. All 312 pre-existing reservation fingerprints match exactly after deployment; no rows changed or disappeared. Existing settings values, slot capacities, and closure dates also match their before-deployment fingerprints. Online reservations are off. The public status endpoint, blocked booking/availability POSTs, unauthorized settings mutation denial, and desktop/mobile bilingual call-page behavior pass live smoke checks. No real booking, SMS, ordering, payment, or production switch-enable test was performed. The authenticated switch's enable/save/disable path was verified against the isolated test environment.
