# Public menu images and combos first

## Milestone
- Scoped public menu image generation; VERIFIED, main, 2026-10-14.
- Owner: Codex. User explicitly requests an image for every menu item in the existing drinks-image style and combos first; previous no-images instruction is superseded.

## Goal / current behavior / required behavior
The public food menu currently shows 65 text-only offerings in 13 categories, starters first, with approved bilingual prices and fixed combo contents. Generate 65 independent, coherent transparent studio food cutouts matching the drinks menu’s isolated polished product photography. Start generation with all nine combos and put combos first in public navigation/content. Use exact known food counts and combo components; unknown portions stay illustrative. Preserve the existing delivery-page UI style and display-only behavior. Use the existing image grid/contain treatment rather than a new design. Add a concise localized illustrative-image caption.

## Scope / dependencies / assumptions
Built-in image_gen, one generation per asset; no CLI/API-model fallback. References inspected from existing local drink originals and tea asset. New immutable versioned project assets, prompt/provenance manifest, display image mapping, combos-first sorting, public rendering/tests and scoped deployment. No database, seed, migrations, prices, provider, ordering or drinks changes. Existing release checkout isolates deployment from security remediation. Generated images are illustrations of approved dish names, not actual restaurant photography or measured portion promises. Use white ceramic serving ware; preserve alpha, center framing, angle and lighting. No new approval gate.

## Change surface / compatibility
New output/food-menu-2026-10-14 originals/prompts/QA, optimized project WebP assets, public-image manifest, display adapter/component and tests. Keep approved source catalog unchanged. No schema/API/auth/configuration/secret changes. Images are public, no private data. No privileged business mutation or audit event is required for file-backed display assets. Use local static paths or immutable existing CDN keys; no asset overwrite. Deployment build excludes migrations and unrelated security work.

## Failure / recovery
Generation failure stays pending with its item ID; retry only that asset. Invalid alpha, cropping, wrong dish/count or missing combo component requires targeted regeneration. Missing asset must fail tests rather than silently show a placeholder. Store every selected deliverable in the project. Preserve previous release for rollback; no data rollback. Inspect all images on labeled contact sheets and full-size where needed, especially quantities/combos; validate alpha/size/hash and render phone/desktop.

## Implementation sequence
1. Inspect drink references and catalog; persist all 65 prompts, combos first.
   User subsequently explicitly requested subagents for speed: delegate independent IDs to three image agents using the same unchanged prompt set and save/alpha-validation helper. Root retains combos, consistency review, source integration, status and deployment ownership.
2. Generate a first combo and inspect style/content, then generate remaining assets with the same prompt scaffold.
3. Review every output; repair defects, optimize without losing alpha, save provenance.
4. Connect one image per approved item, move combos first, use existing image presentation, localized illustrative caption.
5. Unit/source/asset and browser tests, type/lint/safe build; diff review.
6. Deploy only scoped menu changes from exact live source, verify uploaded source hashes/live asset loading/content/flags and update status/evidence; coordinate source integration with security chat.

## Verification / acceptance
- [x] 65 independent final assets saved with prompts/provenance.
- [x] Consistent transparent drinks-style cutouts; exact count/contents where known; all reviewed.
- [x] All 65 item/image associations unique and correct, combos first.
- [x] Public bilingual prices/full combos, search/navigation/no ordering behavior preserved.
- [x] Unit/asset/browser/type/lint/safe production build pass; phone/desktop screenshots reviewed.
- [x] Scoped deployment and live asset/content/preservation checks pass; remaining gates named.

## Progress / final handoff
2026-10-14: read skill, inspected existing transparent drink references; catalog has 56 singles plus nine combos. Prompts prepared before generation. No new assets generated/deployed yet. No provider/hardware launch gate is closed by this task.


## Generation, review and local verification evidence

Three explicitly user-requested agents generated 56 singles in independent ID ranges using the exact shared prompt scaffold; root generated/reviewed nine combos and integrated the set. Built-in image_gen only. Every image is an independent 1254×1254 transparent studio cutout with white serving ware, matched lighting/camera/style. All65 selected PNGs, WebPs and provenance are saved locally; full final prompt set: `output/food-menu-2026-10-14/prompt-set-final.json`. Contact sheets and per-item full-size count checks were reviewed. Targeted corrections fixed Soo Guy/Almond Ding appearances, soy stir-fried macaroni, Cantonese noodle consistency, eight peanut dumplings, vegetable chop suey without noodles and twelve tempura shrimp. Rejected variants retained privately.

All65 WebPs have genuine alpha0–255, square dimensions, no opaque body touching image edges, unique hashes and exact PNG-to-WebP alpha parity. Total selected optimized payload18,329,848 bytes. The existing Buffet Pin media bucket holds immutable content-addressed keys under `food/2026-10-14/`; conditional writes prevent overwrite. All65 final CDN responses are image/webp and SHA-256 identical to local selected files. Replaced immutable variants remain available; no object deletion or existing asset overwrite. Credentials were neither changed nor exposed. Runtime image manifest is public metadata only; generated binaries remain local and CDN-hosted.

Code reuses existing order-grid typography/layout plus the drinks’ transparent object-contain image presentation, eager first-three images and lazy remaining images; no gray placeholders or decorative hero. Combos lead all13 categories in menu/navigation. Every existing item name/printed number/price/serving/component is preserved; approved source JSON and database are unchanged. Added concise bilingual illustrative-image caption. Missing/invalid asset mapping fails closed during projection.

Typecheck, repository lint (zero errors; standard native-image/existing warnings), all285 non-database tests across31 files, safe isolated production build and Chromium workflow at390px/1440px pass. Browser verifies all65 images load, correct localized alt text/prices,13-category order, full combo contents, search/clear/no-results, language persistence, mobile/keyboard category controls, contain-fit/no overflow and no purchase/cart/mutation/ordering requests. Final screenshots reviewed. Asset bounds/hash/alpha reports are in the ignored output directory. Diff reviewed for public-only data, no business mutations and scope isolation.

Production package is exactly current live `dpl_AbkNKHNQsHNRWLHWYoenjoGHSEMW` plus two changed source files (public component/display adapter) and new `content/public-menu-images.json`; every other baseline source is byte-identical. Build command excludes migrations. Separate security code/dependencies, pending official-menu migration/seed/tests and drinks updates are excluded. Deployment/live verification pending.


## Production verification and final handoff — 2026-10-14

VERIFIED. Deployment `dpl_8wf56ALyL3C29bGgtesT7gW2Y53H` is READY and promoted to https://www.buffetpin.com/menu. All224 uploaded source files match the isolated package; comparison with the prior live source proves only public component/display adapter changed and the public image manifest was added. No security dependency/code release, migration, catalog database update, drinks mutation or ordering activation. The no-migration build command and Git automatic-build guard remain intact. Rollback: `dpl_AbkNKHNQsHNRWLHWYoenjoGHSEMW`; CDN originals/versioned derivatives retained.

Live Chromium PASS at390px/1440px, French/English: all65 images decode correctly with localized alt text and object-contain sizing, every approved name/price and full combo is preserved, all13 categories/navigation start with combos, search and category controls work, illustrative caption is present, no overflow/cart/order controls/mutation or ordering API calls. Final phone/desktop screenshots reviewed. Before/after preservation snapshots match home, drinks (all17 loaded image URLs), reservation choices and enabled availability, order page and admin login. No remaining scoped manual/external gate. Hardware/provider/go-live criteria are unchanged.

Saved assets: `public/images/food/2026-10-14/` (65 optimized WebPs); originals, per-item provenance, rejection history, contact sheets, alpha/hash/bounds reports and final prompt set in ignored `output/food-menu-2026-10-14/`. Runtime/CDN mapping: `content/public-menu-images.json`. Built-in imagegen used throughout; no CLI/API model fallback. Only public URLs/dimensions/hashes are committed; generated binaries stay local and on the existing immutable CDN.

Evidence: `docs/launch/evidence/public-menu-images-release.json`, `/tmp/buffet-menu-images-{asset-verification,types,lint,tests,focused-lint,release-build,browser,live-browser,upload,upload-final,deploy,promote}.log`, `/tmp/buffet-menu-images-preservation-after.json`, `/tmp/buffet-menu-images-uploaded.json`, ignored browser screenshots. Scoped source integration is coordinated before the separate security task integrates onto main/origin; no security changes are included in the image deployment.
