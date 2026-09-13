# Drinks catalog restoration

## Milestone
Scoped site release; VERIFIED; 2026-09-13. Branch codex/drinks-catalog, based on live main 7fdd605. Owner: Codex. User authorized generated-media upload, catalog/admin replacement and deployment.

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


## Production verification — 2026-09-13
VERIFIED. Commit c03518e193268794685016ebcbe29aefba90e516 was fast-forwarded to main. Vercel dpl_5VWX7szysxo738qmErHK7LXVu3kR is READY, aliased to https://www.buffetpin.com, with exact matching gitSource. Build reports no pending migrations and successful compilation.

Live browser checks PASS at390/768/1440px: all15 transparent CDN assets, translated reference titles/ingredients, unset prices omitted, no overflow, theme cleanup on navigation, and unauthenticated admin redirect/API401. Four live workflows passed; the fifth authenticated mutation workflow intentionally runs only against the disposable local database and passed there. No live test prices or bookings created.

Production catalog matches all15 manifest rows exactly. All24 original rows retain titles, descriptions, images, prices, category and order and are hidden. Catalog import audit exists with delegated actor and before/after evidence. Reservation, settings, restaurant order settings, closures and slot-capacity fingerprints are identical before/after import and deployment; online reservations and ordering remain false. Public drinks/home/reservation/status HTTP200.

Logs: /tmp/buffet-catalog-production-{build,browser}.log. Private backups and protected-domain hashes: /Users/daniel/buffet-pin/output/drinks-catalog-release-2026-09-13/. Screenshots: ignored test-results/. Original assets remain in the dedicated bucket, with immutable optimized derivatives. Prior Vercel deployment is the tested operational rollback target by architecture (cover page independent of catalog); rollback itself was not performed. No remaining release gate. Staff can enter approved prices in /admin/drinks.

## Local reproduction
Install with npm ci and use Node22.23.2 or later compatible Node22. Start a disposable PostgreSQL17 instance at127.0.0.1:55441, user drinks_test, database drinks_catalog_test. Apply the schema with prisma db push using DATABASE_URL and DIRECT_URL both pointing explicitly to that local database. For the migration-preservation test, prepare a pre-change DrinkItem (without isVisible and with required priceCents), insert category sentinel-category and item migration-sentinel (Preserved drink / Boisson conservée,475cents), then apply prisma/migrations/20260913170000_drinks_catalog/migration.sql. Run scripts/import-drinks-catalog.mjs --apply with the local URL, DRINKS_IMPORT_ACTOR=test-import and a new private DRINKS_BACKUP_PATH. Never use production credentials for this setup.

Run npx vitest run tests/drinks.test.ts tests/drinks.database.test.ts tests/reservation-switch.test.ts tests/reservation-party-size.test.ts tests/media.test.ts, then npx playwright test --config tests/drinks/playwright.config.ts. The browser harness has a localhost-only fake Supabase server and disposable DB coordinates. DRINKS_TEST_URL=https://www.buffetpin.com runs read-only production workflows and skips authenticated mutations. Typecheck: npx tsc --noEmit --incremental false. Build: node scripts/build-reservation-safe.mjs.


## Card framing removal — 2026-09-13
User requests removing the ornamental cards. Remove article backgrounds, outlines, corner rounding, image glow and hover zoom. Preserve the existing responsive grid, image sizing, names, descriptions and prices. This is a presentation-only follow-up; no database or asset mutation. Logo compositing remains pending the separate editing-method clarification. Verification: three existing bilingual catalog browser workflows PASS at390/768/1440px; desktop screenshot reviewed. Typecheck, focused lint (one existing native-image warning), safe production build and scoped diff checks PASS. Deployment pending.


Card framing removal VERIFIED in production: main commit73dc25c84ef2518ad8003aeaeb1b9fcb2a1483e1, Vercel dpl_86yn4yeQAcuD6NTfn2b7TLd85yQv READY with exact gitSource and www.buffetpin.com alias. Three live bilingual browser workflows pass at390/768/1440px. Computed styles confirm all15 articles have transparent background,0px border,0px radius and no image glow. No data, prices or media changed. Previous dpl_5VWX7szysxo738qmErHK7LXVu3kR remains rollback target.

## Official logos on glassware — 2026-09-13
User explicitly approves direct compositing and replacing the live images. Use the original approved RGBA photographs as the exact canvas; insert official online brand artwork with restrained cylindrical projection at a common center. Preserve original alpha and all pixels outside the ink. Coca-Cola artwork is white; Zero uses the official English wordmark with its German localization line omitted and a fine contrasting keyline. Other marks follow Coca-Cola Canada and Canada Dry Canada artwork. No restaurant screenshot used as visual input.

Scope: eight soft-drink images only. Versioned originals and optimized WebP assets are uploaded under drinks/2026-09-13-branded/. Byte verification, alpha verification and contact-sheet review pass. Transactional image URL update records actor and before/after events, checks expected old URLs under row locks, and preserves all other fields. Prior image URLs remain rollback assets. Local source images, logo sources, deterministic compositing script and verification are in /Users/daniel/buffet-pin/output/drinks-branded-2026-09-13/. Production replacement VERIFIED: exactly eight image URLs changed with eight item.image.branding audit events. All other fields and 31 other catalog rows are unchanged. Live bilingual browser checks pass at 390/768/1440px with all 15 assets loaded. The existing dynamic production page serves the new database URLs immediately, preserving the unframed design. No migration or application runtime change is required.

Release source synchronized to main commit 22c8ca60de7b90d7237590883c579a01df77e82d. Vercel dpl_4CboMmb6DssNosdhkUGEw7U2z6Td is READY with matching gitSource and www.buffetpin.com alias. Post-deployment public HTML contains exactly eight branded and seven existing images.
