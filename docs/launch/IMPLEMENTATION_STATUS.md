# Implementation status

## Reservation settings switch — 2026-09-09

`CODE_COMPLETE`; production deployment pending. Scoped change on top of main only. Settings now persists `onlineReservationsEnabled` (default false); authenticated administrator changes record previous/new values, actor and timestamp transactionally. Disabled booking hides public links, displays the bilingual call message, and blocks direct submissions. Existing management/cancellation and data remain intact.

Verification: clean npm install, nine route/unit tests, four disposable PostgreSQL tests, two desktop/mobile/authenticated Chromium workflows, TypeScript, focused lint, safe production build, additive migration/replay, and a backup restore matching all 312 live reservation fingerprints. See `plans/reservation-settings-switch.md` for evidence, rollback, remaining production checks and test setup. Unrelated delivery-launch work in the original checkout is excluded.
