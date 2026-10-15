# Public menu telephone pickup banner

## Milestone
- Status: `VERIFIED`
- Owner: primary agent; branch: main
- Started/updated: 2026-10-15

## Goal and required behavior
Display a dark green banner above the Buffet Pin heading at the top of public menu content, with centered white bilingual copy inviting pickup orders at (450) 699-8088. The entire banner links to tel:+14506998088.

## Current behavior and scope
PublicMenu currently starts with the heading/search. Reuse its existing #062F24 category-heading color, rounded surface and typography. Change only this component, focused browser assertions and launch documentation. Online ordering, catalog, images, APIs and unrelated live behavior remain unchanged.

## Dependencies and assumptions
Existing explicit scoped deployment authorization continues. French/English follows the existing language provider. Telephone ordering is distinct from online ordering activation. No external provider or hardware verification is required.

## Expected change surface / security / compatibility
No database, migration, backfill, API, authorization, audit, sensitive data or configuration changes. Existing staff and customer ordering workflows remain intact. The link opens the visitor's telephone handler; browser automation verifies its destination without placing a call.

## Failure cases and recovery
A wrong number, missing translation, misplaced banner or incorrect colors is caught by focused browser checks. Restore the prior isolated deployment if publication regresses.

## Implementation sequence
1. Add bilingual telephone banner above h1.
2. Verify mobile/desktop placement, styling, copy and unchanged menu behavior.
3. Build and publish the previous live source plus this single component patch; verify live and record evidence.

## Automated verification
Passed: four focused adapter unit tests; bilingual 390px/1440px Chromium workflow; focused ESLint (zero errors, existing img warning); typecheck; safe isolated production build and main build:safe. Browser checks cover both languages and widths, tel href, colors, alignment, placement, catalog and no online purchase requests.

## Manual verification and acceptance criteria
Mobile/desktop screenshots reviewed. Live bilingual mobile/desktop browser workflow passed; home, drinks (all 17 images), reservation, order and admin login snapshots match before publication. Physical calls are not placed. Acceptance requires passing scoped checks, source-only deployment diff, updated ledger and reviewed diff.

## Rollback and deployment considerations
Rollback: dpl_8wf56ALyL3C29bGgtesT7gW2Y53H. Deploy from /tmp/buffet-pin-display-menu-release with npm run build and no migration command. Do not publish newer main dependencies/features.

## Progress log / final handoff
2026-10-15: completed and deployed dpl_7eGRsq9ejvUJAxZ9TKwiNN9LSojF to https://www.buffetpin.com/menu. All 224 uploaded source hashes match; the only source difference from prior live is components/menu/public-menu.tsx. Diff reviewed for correctness/security and missing tests; no remaining scoped manual gate. Automatic Git deployment remains disabled. No schema or provider gate applies to this presentation-only change.
