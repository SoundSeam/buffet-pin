# Drinks image page

## Milestone
Scoped public drinks page; CODE_COMPLETE; 2026-09-12. Branch `codex/drinks-image-page`, isolated from exact live main SHA `596414a7e8b8d3e5f7f3d1ae04d89222c2f0857d`. Prior production: `dpl_Es4t7seC12mLypaok3bKUjv6sprt`.

## Goal / current and required behavior
Replace the public database-rendered drinks list with the user-supplied bilingual Drinks.jpg. Use its sampled #020305 pixel as the entire page background, including header/footer, with white navigation/footer text. Center the uncropped image at the existing max-w-7xl content width with responsive gutters and intrinsic dimensions.

## Scope / assumptions / dependencies
User explicitly authorized this page and its deployment. Use the existing private media bucket through https://d2d93bgcpgtdom.cloudfront.net/misc/Drinks.jpg (1700×2400). Replace the public list; preserve admin drink management and all other pages. Shared layout receives an opt-in drinks theme with unchanged defaults. No dependency, database, API, migration, settings, ordering or credential changes. Follow existing site content width; preserve browser image zoom and include localized alternative text.

## Security, migration compatibility and recovery
Public static media only. No provider side effects or data changes. Existing authentication, reservations and ordering stay unchanged. A failed image request is visible through meaningful alternative text; verify CDN before release. Roll back to the previous Vercel deployment if production smoke fails. No data rollback required.

## Implementation sequence
1. Verify exact live source and isolate clean checkout.
2. Implement image and opt-in theme.
3. Test mobile/desktop image dimensions, theme, mobile menu and navigation away; typecheck, focused lint, safe build.
4. Review scoped diff, deploy only this patch on live main, verify public page and record evidence.

## Verification / acceptance
Pending: image loads without cropping/overflow; page/header/footer #020305 and white text; other pages retain their theme; mobile menu and language work; type/lint/build pass; production deployment matches scoped source. No external/manual business gates introduced.

## Progress / final handoff
Baseline verified using Vercel deployment API gitSource. Source asset already verified HTTP 200 and exact SHA-256. Implementation and deployment evidence pending.

## Automated and visual evidence
- Safe production build: PASS with `node scripts/build-reservation-safe.mjs` under Node 22.23.2; existing production validation preserved, no live credentials/database.
- TypeScript `npx tsc --noEmit --incremental false`: PASS.
- Focused noninteractive ESLint using original repository toolchain/config: PASS, zero errors; four native-image warnings consistent with the existing CDN image approach.
- Existing reservation unit/route regressions: 30 PASS.
- `npx playwright test --config tests/drinks/playwright.config.ts`: three Chromium workflows PASS at 390, 768 and 1440 px against safe production build. Verify CDN dimensions, uncropped ratio, content width, no overflow, exact background/text colors, scrolled header, mobile menu, French/English alt text, and client-navigation theme cleanup.
- Screenshots reviewed for desktop and phone; image is uncropped, navigation clear, footer text white. Browser pinch zoom remains enabled for small embedded menu text.
- Diff reviewed: only public drinks image, opt-in shell/header/footer/language-toggle styling, media manifest, scoped tests and documentation. No schema, migration, dependency or other feature changes. Current live deployment and remote main still match the verified baseline.

Production deployment pending; user authorization already given. Rollback target remains `dpl_Es4t7seC12mLypaok3bKUjv6sprt`. No remaining hardware/provider/manual business gate applies to this page.
