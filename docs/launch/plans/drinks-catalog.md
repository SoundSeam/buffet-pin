# Drinks catalog restoration

## Milestone
Scoped site release; IN_PROGRESS; 2026-09-13. Branch codex/drinks-catalog, based on live main 7fdd605. Owner: Codex. User authorized generated-media upload, catalog/admin replacement and deployment.

## Goal / current and required behavior
Replace the temporary Drinks.jpg cover with the existing bilingual database catalog. Publish the 15 approved generated assets with reference names/descriptions. Make titles and prices editable directly in rows; advanced details and hidden legacy entries remain accessible.

## Scope / dependencies / assumptions
Only drinks pages, APIs, data, media, tests and documentation. Preserve unrelated original-checkout changes. Existing admin email allowlist, PostgreSQL and dedicated S3/CloudFront remain authoritative. Prices in existing 24 rows match seed examples; reference has none. Await user prices; nullable price is omitted publicly until entered. Hide (retain) legacy sample rows. Use current generated packaging formats (Corona/Perrier 330mL; Oasis 300mL), documented in generated reference record. No ordering or reservation behavior/settings changes.

## Change surface and security
Add optional price, item visibility and append-only DrinkMenuEvent with actor, timestamp, before/after JSON. Price nullable broadens compatibility; new public projection never displays null as zero. All menu writes remain allowlisted and audit atomically. PATCH uses updatedAt optimistic concurrency to reject stale edits. No production credentials committed. Import writes only drinks tables and saves a private backup before mutation; stable IDs and create-only initialization make reruns safe for staff edits.

## Failure and recovery
Validation, expired session, stale edit or save failures leave draft visible with a useful message. Blank price is hidden, zero is an explicit price. Missing images retain readable text. Database errors show a localized unavailable message, never sample content. Hide/reveal replaces deletion in normal editor workflow. Roll back Vercel to 7fdd605; cover page ignores new nullable data. Keep additive migration and restore scoped backup if needed; never reset the database.

## Sequence
1. Confirm baseline and database content; isolate release.
2. Upload versioned assets, implement migration/catalog and simple admin editing.
3. Verify validation/auth/audit/conflict behavior with unit and disposable-database tests; verify responsive public/admin workflows in browser, typecheck, safe build, focused lint.
4. Review scoped diff, backup/import content, deploy scoped commit, verify production source/assets/status and document evidence.

## Acceptance / verification
AC-G01 reproducible checks, AC-G02 preserved fail-closed config, AC-G07 authorized audited menu changes. No delivery acceptance criteria altered. Pending: 15 images loaded, all bilingual reference details, exact cents, responsive layout, admin save/failure/conflict behavior, auth denial, migration preservation and rollback, production smoke. No hardware gate for this scope.

## Progress and handoff
2026-09-13: Live main isolated. Existing database has 24 seed rows, no approved prices. Online ordering and reservations both false. AWS soundseam profile resolves correct account559050218020. Vercel production env pull masks sensitive values; existing local database credentials work and remain private. No production write yet.

## Verification — 2026-09-13
- 42 tests PASS: exact cents/comma/blank/zero validation, partial-update preservation, denied reads/mutations, conflict response, visible-only projection, failure behavior, PostgreSQL atomic audit/rollback/concurrent edit, and existing reservation/media regressions.
- Five Chromium workflows PASS, 390/768/1440px: 15 real CDN images load, bilingual ingredients/titles, unclipped responsive layout, title/price saves reflected publicly, failed save retains draft, stale edit reload/retry, hide/reveal, hidden legacy recovery, admin authentication and navigation away from dark theme. Screenshots inspected.
- TypeScript PASS; focused ESLint zero errors, two expected native-image warnings. Safe production build PASS under Node22.23.2 with disposable values only; final rebuild after the last robustness edits PASS.
- Uploaded 15 optimized WebP assets plus original transparent PNGs under drinks/2026-09-13/. All CDN WebP responses HTTP200, byte-identical and alpha-preserving; 900px square, 1.86MB total.
- Disposable migration applied to pre-change drinks columns with a preserved 475-cent sentinel. Import rerun retained existing edits. Import no longer selects post-migration fields during pre-migration dry-run.
- Production migration history contains 21 previously applied ordering migrations absent from this isolated live-main snapshot. Preserve them; apply only the new drinks migration using migrate deploy. Do not reset or reconcile unrelated schema history. Dry-run reports eight categories /24 legacy drinks; new catalog is15. Protected reservation/settings fingerprints saved privately before deployment.
- Review fixed existing Zod partial-default behavior that cleared omitted fields, ensured revision timestamps advance even within one millisecond, and kept save-response parse errors understandable.

## Rollback specifics
Prior production dpl_2xkNND1xELfAxtmefqzxTQ8mop3J renders the image cover independently of drink rows. It can be restored without reversing this additive migration. The one-time catalog.import event includes the complete before snapshot; local private backup is under /Users/daniel/buffet-pin/output/drinks-catalog-release-2026-09-13/. Do not replay old seed scripts or remove unrelated migrations. No pending provider/hardware gate for this site-only scope; staff may enter prices later.

## Production data preparation
Final safe build, typecheck and focused lint PASS. Migration 20260913170000_drinks_catalog applied successfully alone to production. Catalog import saved a private before snapshot and created an actor-attributed import event; 15 approved entries are visible, legacy24 retained hidden, all new prices unset. Protected reservation/settings/order-settings fingerprints are byte-identical after import. Deployment next; current public cover remains available throughout preparation.
