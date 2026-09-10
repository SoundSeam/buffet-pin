# Implementation status

## Reservation settings switch — 2026-09-09

`VERIFIED` for this scoped reservation change; deployed to production from main on 2026-09-09 (America/Montreal). Scoped change on top of main only. Settings now persists `onlineReservationsEnabled` (default false); authenticated administrator changes record previous/new values, actor and timestamp transactionally. Disabled booking hides public links, displays the bilingual call message, and blocks direct submissions. Existing management/cancellation and data remain intact.

Verification: clean npm install, nine route/unit tests, four disposable PostgreSQL tests, two desktop/mobile/authenticated Chromium workflows, TypeScript, focused lint, safe production build, additive migration/replay, and a backup restore matching all 312 live reservation fingerprints. See `plans/reservation-settings-switch.md` for evidence, rollback, remaining production checks and test setup. Unrelated delivery-launch work in the original checkout is excluded.


Production evidence: feature commit `bdc585801ab1b59427977b68d02c46bed7ceb127`, Vercel deployment `dpl_DDABEwtqf5bRjo3Uzs891d3s3XiK`, live at `https://www.buffetpin.com`. The new migration applied successfully. All 312 pre-existing reservation fingerprints match exactly after deployment; no rows changed or disappeared. Existing settings values, slot capacities, and closure dates also match their before-deployment fingerprints. Online reservations are off. The public status endpoint, blocked booking/availability POSTs, unauthorized settings mutation denial, and desktop/mobile bilingual call-page behavior pass live smoke checks. No real booking, SMS, ordering, payment, or production switch-enable test was performed. The authenticated switch's enable/save/disable path was verified against the isolated test environment.


### Image regression correction — 2026-09-09

The first main-based deployment restored old direct S3 URLs and broke the image fix previously present outside main. The user identified this regression. The dedicated CloudFront media manifest and its eight asset mappings are now restored on main, including navbar/footer logos, map icons, homepage videos, ordering food image, and checkout logo; reservation settings and data are unchanged. Correction deployed from main commit `ba6ca3a8174977e0dc29261e9676c4becce11016` as Vercel deployment `dpl_TNnFf1XRbzsTyfz41agvuWYJjqQU`. Local and live browser checks require loaded images, not only visible page structure. Live homepage logos, map icons, and background video load successfully; reservation-page logos load and the call message remains active.


### Dedicated media bucket verification

The user suggested a dedicated Buffet Pin bucket. This already exists as `buffet-pin-media-559050218020` in `us-east-2`, containing exactly the eight required assets. Its non-public bucket policy permits the dedicated CloudFront distribution `E1DVTDEQ25O29`; the prior media-isolation record identifies its domain as `d2d93bgcpgtdom.cloudfront.net`. All eight CloudFront responses return 200 with content lengths and ETags matching the dedicated bucket. Both it and `soundseam-origin` have all four S3 Block Public Access controls enabled. No bucket was created, made public, altered, or deleted during this correction; no source objects were removed. Current credentials permit S3 verification but not CloudFront control-plane inspection; existing CDN delivery was verified directly.


## Reservation switch alignment — 2026-09-10

CODE_COMPLETE. Separate the visible 56×32px track from its 44px clickable button so the 24px thumb has even 4px spacing on both sides of travel. Only the reservation settings component and this task's documentation change; reservation state/data and media configuration remain untouched. Measured desktop/mobile geometry, both switch states, keyboard activation, visual review, existing Chromium workflows, focused lint, and safe production build pass. Deployment evidence is recorded in `plans/reservation-settings-switch.md`.
