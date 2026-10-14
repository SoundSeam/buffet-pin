# Public display-only food menu

## Milestone

- Name: Scoped public menu browsing; separate from the delivery launch.
- Status: `VERIFIED` — text-only restaurant sequence deployed and checked live.
- Branch: `main` working checkout; isolated deployment snapshot at `/tmp/buffet-pin-display-menu-release` starts from the exact live source `c874e11765053c75d4278aaf3fbed90e00f655d7`.
- Owner: Codex; restaurant owner reviews menu presentation.
- Started / last updated: 2026-10-14.

## Text-only restaurant sequence — 2026-10-14

User requests restaurant-style ordering and no images because no dish photos exist. This supersedes the image/banner requirements in earlier records. Remove the decorative food banner and every gray image placeholder; retain branding in the shared header/footer. Use existing order-summary row typography, neutral dividers, search and category navigation for a compact text-only menu, without adding a new visual treatment.

Public display sequence: appetizers, dumplings, soups; chicken, beef, pork, seafood, vegetarian, chop suey; rice, noodles, macaroni; combos/family meals. Preserve printed dish numbers and source order within each category. This is a reversible display-only sort; do not modify the approved manifest, database catalog, prices, combo contents or ordering system.

Authorized continuation includes scoped deployment. Change only `components/menu/public-menu.tsx` and `lib/menu/display-menu.ts` in the isolated release based on current live `dpl_FqE68pfavQC22D6MKZAMHnbmGxTB`. Verify all 65 items/13 categories, restaurant ordering, no food image/placeholder/background image, exact bilingual prices/full combos, search/category controls, responsive text rows, and display-only boundaries. Existing content-preservation and deployment checks apply; no migration or unrelated release. Rollback: `dpl_FqE68pfavQC22D6MKZAMHnbmGxTB`.

## Corrective scope — 2026-10-14

The user rejects the initial green/cream/gold presentation and explicitly requires styling from the delivery order page, with no invented styling, and deployment when finished. This supersedes the initial visual requirements below; their first-release evidence remains historical.

Use `components/order/order-flow.tsx` directly as the presentation reference: identical white page surface, food banner, compact Buffet Pin heading, existing search control, item-grid geometry, gray square image fallback, item typography/prices and summary-panel styles for category navigation. Remove the previous dark menu design. Retain exact menu content, French/English, full combo details and display-only boundaries. No changes to ordering behavior or other public pages. Local search filters public display data only. Use the existing checkout select styling for mobile category navigation; desktop category links use the order summary panel styles. No new palette, CSS file, decorative treatment, or assets.

Deploy only this component correction on top of `dpl_91SWuMdypzJrNwWaRamHFMBv5xtw`, preserving its no-migration build command and every unrelated source file. Verify computed visual parity with the actual delivery page, mobile/desktop screenshots, bilingual content/search/category behavior and no ordering mutations. Rollback target for this correction is `dpl_91SWuMdypzJrNwWaRamHFMBv5xtw`.

## Goal

Visitors can open `/menu`, browse clearly grouped food items and prices in French or English, and understand that the page is for viewing. It contains no delivery or pickup purchase flow and works while online ordering is disabled.

## Current behavior

- `app/menu/page.tsx` explicitly calls `notFound()`.
- `components/menu/menu-hero.tsx` and `menu-sections.tsx` already provide green/cream/gold presentation, category anchors, responsive cards, and scroll tracking. Their older translated menu content and required image layout should not be republished unchanged.
- `components/drinks/drinks-menu-page.tsx` demonstrates localized names, CAD formatting, category headings and a public browsing layout. `/drinks` stays its own destination.
- `content/official-delivery-menu.json` contains the approved 65 food offerings in 13 ordered categories, bilingual labels, printed numbers, pretax CAD prices and fixed combo contents. Many items have no image or description.
- `/api/menu` is an ordering projection: it filters delivery availability, exposes modifier/order settings and upserts a default settings row. It is unsuitable for a strictly read-only display page.
- `app/robots.ts` disallows `/menu`, and `app/sitemap.ts` omits it. Public navigation must be checked in both languages and both viewport layouts.
- The worktree already contains official-menu integration, documentation, tests, migrations and image work. Preserve every pre-existing change.

## Required behavior

1. Publish a dedicated food menu route within the existing `SiteShell`, with a concise title and bilingual display-only explanation.
2. Show ordered category navigation followed by matching sections. Use stable anchors, active-category indication, keyboard focus, and scroll offsets below the fixed header. On phones the category bar scrolls horizontally without widening the page.
3. Render noninteractive item articles with printed number where present, localized name, approved description/portion where supplied, and a clearly aligned CAD price. Show full combo contents; avoid truncating essential information.
4. Use the site's existing deep green `#041F18`, cream `#F4E8D2`, gold `#C9A56A`, typography, rounded surfaces, content width and spacing. Prefer compact text-first rows/cards: one column on phones, two on larger screens. Missing images occupy no blank space; do not generate food imagery for this scope.
5. Present approved prices as pretax CAD, with localized tax/availability wording. Do not label these delivery-menu prices as buffet admission or assert dine-in pricing equivalence.
6. Provide a localized Menu link in desktop/mobile public navigation and a simple link to the separate drinks menu. Restore indexing with canonical metadata, robots and sitemap changes.
7. Include no add buttons, quantities, cart, item customization, checkout links, fulfillment selector, delivery-address collection or ordering status prompts. Browsing must not invoke pricing, order creation, payment or provider operations.

## Scope

### In scope

Public food menu, existing style reuse, French/English presentation, category browsing, discoverability, accessible mobile layout, focused regression tests and documentation.

### Out of scope

Ordering/pickup changes, enabling channels, reservations, drinks redesign, menu editor redesign, schema/migrations, catalog import/application, provider integrations and generated images. Deployment of this scoped change is authorized.

## Dependencies and assumptions

- Initial source: project the approved `content/official-delivery-menu.json` through a small typed display adapter. Do not duplicate its content in translation files or call the ordering endpoint. This allows browsing without applying the pending catalog migration or requiring a database/Clover connection.
- The user authorized this reversible source choice when requesting execution/deployment: database admin edits will not automatically update this manifest-backed page. Later live catalog synchronization would need an explicit display-visibility policy and a read-only projection; it is outside this plan.
- Use the current 65 approved offerings as the initial public food selection, without claiming it is the complete buffet selection. No unsupported dishes, descriptions, portions, substitutions or additional-person options.
- Preserve existing fixed-combo rules and prices exactly; the display adapter must handle structured combo contents rather than flattening away information.
- No external credentials or hardware are needed for implementation/testing. The user authorized execution and deployment of this plan. Preserve the approved price context and display-only wording; no additional approval gate is required.

## Expected change surface

### Files and modules

- `app/menu/page.tsx`: route composition, metadata and server-provided display data.
- `lib/menu/display-menu.ts` (proposed): minimal typed adapter selecting approved display fields and stable ordering.
- `components/menu/public-menu.tsx`: reuse the existing menu styling and category pattern in a dedicated display component. Keep the older unused menu components unchanged to minimize shared behavior changes.
- `lib/i18n.ts`: localized navigation and display-only page copy; remove obsolete menu claims where applicable.
- `components/layout/navbar.tsx`: ensure the Menu entry appears in desktop/mobile navigation without adding an order CTA.
- `app/robots.ts`, `app/sitemap.ts`: make `/menu` discoverable.
- Focused unit/browser tests; this plan, decisions and status ledger.

### Database / API / UI boundaries

No database changes, backfill, new public API, credentials, provider behavior or privileged mutations. Only customer browsing UI changes; staff, dispatcher, driver and reporting interfaces remain unchanged. No new idempotency or audit requirements arise because browsing has no business-state mutations. Existing framework asset/navigation requests are expected.

## Security and privacy

Expose only public menu fields, never import metadata, provider IDs, settings or private records. No personal information is collected. Public rendering must work independently of ordering flags and database availability. Preserve all existing server authorization and production validation. No configuration/secret changes.

## Failure cases and recovery

| Failure | Detection / impact | Recovery | Automated coverage |
|---|---|---|---|
| Missing description/image | Item still readable with no empty placeholder | Text-first layout | Sparse-item rendering |
| Invalid category reference, duplicate key or price | CI rejects invalid source/projection | Correct reviewed content before release | Adapter validation/parity |
| Empty approved catalog | Clear localized unavailable message | Restore reviewed catalog; never fall back to samples | Adapter empty-state test and rendering review |
| Long label/combo or 13 categories on mobile | Wrapping without clipping/overflow | Responsive text and category bar | 390px browser checks |
| Ordering disabled or DB unavailable | Menu remains browseable | No recovery needed for display | Standalone route/browser verification |
| Reduced motion / keyboard use | Content stays visible; anchors operable | Honor motion preference and native links | Browser accessibility checks |

## Implementation sequence

1. Recheck worktree boundaries and source shape; inventory shared menu component consumers and navigation copy.
2. Add the display adapter and exact source-parity tests for all 65 items, 13 categories, amounts, numbers and fixed combo contents.
3. Restore `/menu` with existing shell/style and localized display-only copy; adapt category navigation and text-first item cards.
4. Add public navigation, drinks cross-link and SEO discovery updates.
5. Verify browsing causes no business writes or ordering/provider calls; review responsive screenshots, keyboard use, language switching and long combo content.
6. Run scoped tests, required checks and diff review; update plan/status with evidence and remaining owner review. Publish only the isolated source patch under the explicit deployment authorization, then verify production.

## Automated verification

- Unit: source-to-display parity, sorting, stable anchors, optional fields, prices, combo rules and invalid-source rejection.
- Browser: public `/menu` at 390px and 1440px; all categories/items/prices; language persistence; desktop/mobile navigation; category anchors; full combos; absent image layout; no horizontal overflow; keyboard focus and reduced motion.
- Boundary: no `/api/menu`, cart-pricing, order, payment or provider calls while opening/navigating the menu; no cart session created. Confirm page works with ordering disabled and without database access. Account for existing shared-shell read-only reservation availability requests.
- Regressions: home, `/drinks`, reservation navigation and existing order-page tests remain valid.
- Commands at implementation: `npm run typecheck`, `npm run lint`, focused Vitest/Playwright suites, `npm run build:safe`; broaden tests only for actual shared behavior changes.
- Provider contracts/database migration tests: not applicable unless scope changes. Production and hardware claims remain outside this task.
- Planning verification: repository inspection only; no application tests run or claimed.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
| Menu layout and language review | Local safe build and production, 390px/1440px | Implemented menu | Readable prices, full combos, clear display-only purpose | Playwright and reviewed screenshots | PASS |
| Approved content and price context | Source/local/production | User-authorized plan and approved manifest | Exact pretax CAD prices and display-only wording | Source parity and live bilingual checks | PASS |
| Public release smoke | Production | User-authorized isolated deployment | Menu/navigation work; existing pages preserved | READY identity, live browser and before/after smoke | PASS |

## Acceptance criteria

- [x] `/menu` returns a public browseable page rather than 404.
- [x] All 65 approved items in 13 categories match source prices, numbers and contents.
- [x] Existing site styling is reused; descriptions and missing images render cleanly.
- [x] French/English, phone/desktop, keyboard and category navigation pass.
- [x] No delivery/pickup purchase affordances, business writes or ordering dependency.
- [x] Navigation, canonical metadata, robots and sitemap agree.
- [x] Focused tests, typecheck, lint and safe build pass; scoped diff reviewed.
- [x] Documentation/status contain evidence and any remaining review gates.
- [x] Applicable AC-G01/G02 checks preserved; no launch milestone or provider/hardware verification upgraded.

## Rollback and deployment considerations

No data rollback or feature activation is required. Revert only this scoped page/navigation/SEO implementation to restore the previous route behavior. Preserve all pre-existing work. The user subsequently authorized deploying only this change. Build from the exact live source plus the scoped menu patch. Use a build command without migrations; preserve auto-deploy guards and existing flags. Do not apply pending migrations or enable ordering.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-10-14 | Prepared plan from repository inspection | Route, components, manifest, ordering endpoint and discovery configuration inspected | Manifest-backed display is proposed; implementation not started |

## Final handoff

- Files: new display adapter/component, menu route, navigation translation entries, robots/sitemap, scoped tests and documentation. No source change to the existing shared navbar or shell was necessary.
- No database/schema/API/credential/provider changes, migration apply, ordering activation, Git push or unrelated source publication.
- All applicable local checks and live menu/preservation checks pass. No remaining scoped manual/external gate; delivery launch gates are unchanged.
- Current public page: https://www.buffetpin.com/menu.
- Current production release: `dpl_AbkNKHNQsHNRWLHWYoenjoGHSEMW`; prior public-menu release `dpl_FqE68pfavQC22D6MKZAMHnbmGxTB` is the rollback target.
- Catalog remains file-backed as authorized; database admin edits do not automatically update the public menu.

## Implementation evidence — 2026-10-14

- Added `lib/menu/display-menu.ts`, `components/menu/public-menu.tsx`, route composition, two localized navigation entries and SEO discovery changes. Existing menu components remain unchanged; no broad refactor.
- Adapter rejects duplicate IDs, broken category references and invalid amounts, exposes only display fields and preserves exact fixed combo components/servings. Three unit tests cover source parity, invalid content and empty catalog.
- All 284 tests across 31 non-database files pass. Typecheck passes; repository ESLint passes with zero errors and 26 existing warnings. Final main `npm run build:safe` passes under Node 22.23.2. No database/provider suite required because no database/provider behavior changes.
- The isolated current-live-source build also passes using explicit non-production values and no database. The shared reservation status query fails closed as expected; menu browsing remains functional. Strict production validation was preserved.
- Focused Playwright workflow passes on the isolated production build at 390px/1440px: all labels/prices in FR/EN, all category/item counts, full Combo 7, keyboard anchors, active category, language persistence, no clipping/overflow, no cart, no mutation or ordering API requests. Initial active-category offset defect was fixed and the workflow passed on rerun. Viewport screenshots visually reviewed.
- Exact production package: base `c874e11765053c75d4278aaf3fbed90e00f655d7`; modified `app/menu/page.tsx`, `app/robots.ts`, `app/sitemap.ts`, `lib/i18n.ts`, `vercel.json`; added `content/official-delivery-menu.json`, `lib/menu/display-menu.ts`, `components/menu/public-menu.tsx`. All other tracked baseline files byte-match. Dependencies, Prisma schema/seed/migrations, APIs, reservation and ordering logic remain the exact live versions.
- Deployment-only `vercel.json` uses `npm run build` to prevent migration execution and preserves the existing live cron. Adds `git.deploymentEnabled=false` to preserve the current deployment-control policy. The main checkout deployment config is unchanged.
- Manifest and logs: `/tmp/buffet-menu-release-manifest.json`, `/tmp/buffet-menu-*.log`. Rollback: `dpl_FnmZX1EeGPgeiGZcDRxeaLnnQK9e`.
- Local scoped diff reviewed for public-only data, authorization boundaries, absence of business writes/provider calls, source parity, accessibility and deployment isolation. No test claims cover physical/provider launch gates.


## Production verification — 2026-10-14

Deployment `dpl_91SWuMdypzJrNwWaRamHFMBv5xtw` is READY and promoted to https://www.buffetpin.com. Vercel API identity and alias readback match. The recorded build command is `npm run build`, and its logs contain no migration execution. All 223 uploaded source file SHA-1 values match the isolated release files; the eight scoped production changes match the recorded release manifest. The Vercel project automatic-build guard remains `exit 0`.

Live Playwright workflow PASS at 390px/1440px in French/English, including every label/price, category counts and keyboard anchors, active selection, mobile/desktop Menu navigation, language persistence, full combo details, canonical metadata, no overflow/cart state and zero mutating or ordering API requests. Live robots/sitemap discovery PASS.

Read-only before/after preservation snapshots match for home, drinks headings and all 17 image URLs/loaded states, reservation choices and enabled availability, ordering page and admin login. No reservation, ordering setting, catalog/database row, Clover/provider state or credential was changed. Unrelated local work remains preserved and unpublished. No remaining gate applies to this scoped public menu release.

Evidence: `/tmp/buffet-menu-live-browser.log`, `/tmp/buffet-menu-live-after.json`, `/tmp/buffet-menu-uploaded-files.json`, `/tmp/buffet-menu-preservation-before.json`, `/tmp/buffet-menu-preservation-after.json`, `/tmp/buffet-menu-deploy.log`, `/tmp/buffet-menu-promote.log`. Screenshots in ignored `test-results/` and `/tmp/buffet-menu-top-*.png`. Release manifest retained at `docs/launch/evidence/public-display-menu-release.json`.


## Order-page presentation correction — implementation evidence

- Exact visual source: live `/order` and `components/order/order-flow.tsx` (`renderMenu`, menu header/search, summary aside and checkout field). The dark public-menu treatment is removed.
- Directly reused banner asset/sizing/radius, white page/container/spacing, compact Buffet Pin heading, search field/clear button, 360px sidebar layout, square gray image fallback/icon, three-column product-grid classes and name/price typography. Category sidebar uses the existing summary-panel classes; the mobile category selector uses existing checkout-field classes. No custom CSS, palette, new asset or changes to the delivery page.
- Noninteractive articles replace item purchase buttons; add/quantity/cart/checkout controls are absent. Full combo contents and exact approved prices remain. Localized search and category jumps operate on display data only.
- Typecheck, repository ESLint (zero errors, existing warnings), all 284 non-database tests and the isolated safe production build pass. A focused mobile/desktop workflow passes for source parity, French/English, language persistence, keyboard/category navigation, search/clear/no-results, no overflow, and no mutation/ordering requests.
- A computed-style comparison against the actual live delivery page passes for banner, heading, product image dimensions/radius, name and price. Mobile/desktop screenshots were reviewed. A hidden mobile navigation container's desktop spacing was corrected before final verification.
- The isolated release has exactly one source-file difference from current production: `components/menu/public-menu.tsx`. Existing dependencies, migrations, APIs, credentials, catalog data, settings, booking and ordering behavior remain outside this release. Separate dependency-security work in another chat is not included.
- Final local verification passes after the spacing correction. All 223 uploaded source hashes match the isolated release; comparing the uploaded sources to prior production proves only the public menu component changed. Corrective publication/live verification complete; prior public-menu deployment remains available for rollback.


## Corrective production verification — 2026-10-14

Deployment `dpl_FqE68pfavQC22D6MKZAMHnbmGxTB` is READY and promoted to https://www.buffetpin.com/menu. Alias identity and `npm run build` (no migration) command were read back. Uploaded source trees prove all 223 files match the isolated package and exactly one file changed from the prior public-menu release: `components/menu/public-menu.tsx`.

The live 390px/1440px Chromium workflow passes: 65 items, 13 categories, exact French/English names/prices, full combos, local search/clear/no-results, language persistence, keyboard desktop category links/mobile category selector, zero horizontal overflow, white surface/black heading, canonical metadata and no purchase controls/cart state/mutating or ordering requests. Live delivery/public-menu computed styles match exactly for banner, heading, image geometry/radius, names and prices. Final screenshots reviewed.

Before/after preservation snapshots match for home, drinks (17 identical loaded images), reservation choices and enabled availability, order page and admin login. This release includes no other source/dependency/migration/settings/provider change. No remaining verification gate for the correction. Other launch and dependency-security work remains separate.

Evidence: `docs/launch/evidence/public-display-menu-restyle-release.json`, `docs/launch/evidence/public-display-menu-style-parity.json`, `/tmp/buffet-menu-restyle-live-browser.log`, `/tmp/buffet-menu-restyle-live-parity.log`, `/tmp/buffet-menu-restyle-preservation-after.json`, `/tmp/buffet-menu-restyle-deploy.log`, `/tmp/buffet-menu-restyle-promote.log`. Rollback target: `dpl_91SWuMdypzJrNwWaRamHFMBv5xtw`. No Git commit/push performed by this task; pre-existing local work preserved.


## Text-only release verification — 2026-10-14

VERIFIED. Current production `dpl_AbkNKHNQsHNRWLHWYoenjoGHSEMW` is READY and promoted to https://www.buffetpin.com/menu. Uploaded source verification covers all 223 files, with exactly two differences from the prior live release: public component and display adapter. `npm run build` executes without migrations; no dependency-security work is published.

Removed the decorative food banner, all image placeholders and image-icon imports. Compact text/price rows reuse existing order-summary dividers and delivery-page typography. Display category order is appetizers, dumplings, soups; chicken, beef, pork, seafood, vegetarian, chop suey; rice, noodles, macaroni; combos/family meals. All printed dish numbers and item order within categories remain intact. Source catalog data, approved prices, serving counts and combo components were not changed by this refinement.

Evidence: typecheck and lint pass (zero errors; existing warnings); all 285 non-database tests across 31 files pass, including a new restaurant-sequence assertion; safe production build passes; focused local and live Chromium workflows pass at 390px/1440px in French/English. Browser assertions cover all 65 names/prices, 13 categories and exact sequence, no food images/backgrounds/placeholders, full combos, local search/clear/no-results, native mobile category selection, keyboard desktop links, no overflow, no cart/purchasing/mutating or ordering requests. The existing select-arrow SVG is a navigation icon, not a food image; its native existing styling remains. Final screenshots reviewed.

Before/after home, drinks (all 17 loaded image URLs), reservation choices/enabled availability, order and admin-login snapshots match. Project automatic-build guard remains `exit 0`; repository automatic Git deployments remain disabled. No other public page, database, provider, settings or credential change. No remaining scoped gate. Rollback: `dpl_FqE68pfavQC22D6MKZAMHnbmGxTB`.

Release manifest: `docs/launch/evidence/public-display-menu-text-release.json`; logs: `/tmp/buffet-menu-text-*`; browser screenshots: ignored `test-results/display-menu-order-style-*.png`. Main/origin source integration is coordinated with the separately user-authorized security chat; the exact already-approved manifest is included as the public page’s data dependency, while unrelated official-menu migration/seed/integration tests and drinks assets remain unstaged. Shared launch documents include only this task’s sections in the source commit.
