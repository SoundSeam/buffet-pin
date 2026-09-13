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


## Online reservation guest limit — 2026-09-10

CODE_COMPLETE in isolated branch `codex/reservation-five-guest-limit` on exact deployed `c69a427`. Existing UI choices/copy only: public 1–5 guests, phone for 6+. Server enforces availability/create/edit bounds; staff retain larger phone bookings and can manage the new small bookings. Existing larger records retain contact edits/cancellation; rescheduling at 6+ requires calling. No schema, migration, dependency, asset, ordering or availability-switch change. Verification: 30 unit/route tests, nine disposable PostgreSQL/API tests, four desktop/mobile Chromium workflows, TypeScript, focused lint (zero errors/two existing warnings), safe production build and reviewed screenshots/diff. Production publication and smoke remain pending explicit authorization. See `plans/reservation-five-guest-limit.md`.

## Drinks image page — 2026-09-12
CODE_COMPLETE in isolated `codex/drinks-image-page`, based on live main `596414a`. Scope: public image menu and opt-in dark layout only. Plan: `plans/drinks-image-page.md`.

Drinks page evidence: safe production build, TypeScript, focused lint (zero errors), 30 existing reservation tests and three new Chromium layout/navigation workflows pass. Mobile/desktop screenshots reviewed. Production release is authorized and pending; no migration, database or unrelated application change.

## Drinks catalog restoration — 2026-09-13

`VERIFIED` for the scoped release on `codex/drinks-catalog`, isolated from live main `7fdd605`. Restores the bilingual database menu with 15 CDN-hosted transparent generated assets. Admin titles and exact-cent prices edit inline with per-row save, retained drafts on failure, stale-edit detection, optional image/description/visibility controls and hidden-entry recovery. Nullable prices stay absent publicly. All drinks mutations record transactional actor/before/after audit evidence. The additive migration and one-time import preserve legacy data.

Verification: 42 unit/database/regression tests and five Chromium workflows pass at 390/768/1440px, including authenticated saves reflected publicly, failed-save recovery, concurrent-edit rejection, hide/reveal and auth denial. Typecheck and focused lint pass (two native-image warnings); safe production build passes. All 15 WebP files match uploaded bytes and preserve alpha, 1.86MB total; original PNGs are also in the private bucket. Migration preserved a sentinel and importer rerun preserved edits. Production migration/import and deployment completed: commit c03518e, Vercel dpl_5VWX7szysxo738qmErHK7LXVu3kR READY at https://www.buffetpin.com. Four live browser workflows pass; all 15 manifest entries match and all 24 legacy entries are preserved hidden. Protected reservation/settings fingerprints are unchanged; bookings and ordering remain disabled. Authenticated mutation checks passed locally; production smoke remained read-only. Plan: `plans/drinks-catalog.md`.


### Drinks card framing removal — 2026-09-13
CODE_COMPLETE: user requests unframed drinks on the existing page. The card background, border, rounded framing, image glow and hover zoom are removed. Layout and catalog data remain intact. Responsive browser checks, typecheck, lint and safe build pass. Deployment pending; see plans/drinks-catalog.md.
