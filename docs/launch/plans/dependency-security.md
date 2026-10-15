# Dependency security remediation

## Milestone
- Name: Scoped dependency security remediation, post-M11.
- Status: IN_PROGRESS.
- Branch: codex/launch-security-dependencies; integrate onto main/origin/main after verification.
- Owner: Codex. Started/updated: 2026-10-14.

## Goal
Remove all current production and full-graph advisories with reproducible installation, preserving appearance, public menu, reservations, drinks and all ordering invariants.

## Current behavior
October 13 inspection: production audit 9 affected package entries (1 moderate/6 high/2 critical); full audit 26 (5 moderate/19 high/2 critical), 36 unique advisories. Next 15.5.22, Sharp 0.35.3, MapLibre 5.24.0, Prisma/client 6.19.3, global brace-expansion 5.0.8. Existing dirty official-menu/drinks/public-menu work is preserved and copied into the isolated worktree for verification, not staged as security work. Active menu chat owns its presentation/deployment; security owns dependencies, build/lint configuration and map compatibility. No security deployment authorized.

## Required behavior
Zero findings at every severity in both graphs. Retain card tokenization, authoritative non-downgrading payment reconciliation, paid-only unique initial printing, audited reprints/refunds, immutable snapshots/audits, durable intents/idempotency, assigned-driver permissions, packed/desk pickup, maximum-four and same-zone runs, recoverable failures and fail-closed configuration. Preserve public browsing-only menu and reservations/drinks. User confirms printing works; rehearsals are hardening, not security prerequisites.

## Scope
### In scope
Dependency/lock/runtime configuration, narrow qualified overrides, MapLibre/Tailwind migration preserving appearance, lint-rule-preserving source adaptation, security/compatibility/regression verification and CI gates.
### Out of scope
Production deployment, database/provider mutations, enabling ordering, unrelated product changes and major Next/Prisma/React maintenance.

## Dependencies
Existing deterministic fakes, disposable Postgres, Playwright and safe build. No real credentials needed. Native image/worker compatibility verified locally and Linux checks configured in CI. Coordinate menu shared docs and main integration.

## Assumptions
Use Node 22.23.2/npm 11.8.0 (npm10.9.8 peer resolution crashed; no force/peer bypass). Tailwind 4 browser floor Safari 16.4/Chrome 111/Firefox 128; preserve v3 visual semantics explicitly. Prisma deepmerge-ts 8 candidate is qualified before retention; no unsupported compatibility claim. Unpatched braces paths must be removed through actual tooling/source changes, not advisory suppression.

## Expected change surface
### Files and modules
package.json/lock, .nvmrc, PostCSS/Tailwind/globals CSS, ESLint configuration and licensed lint-source adaptation, delivery-zone-map, tests, scripts/verify, CI, security documentation/ledger/decisions.
### Database changes
None. Existing migrations/schema/seed unchanged by security; compatibility verified only in disposable databases. No backfill or data rollback.
### API changes
None. Authorization/idempotency/provider contracts retained.
### UI changes
Visual parity for public/customer/kitchen/driver/admin screens; compatible map worker and visible unavailable-map fallback.

## Security and privacy
No credentials/card data/new privilege boundaries. Audit gates check every severity in both graphs. Overrides scoped with rationale, compatibility tests and upstream removal conditions. Keep production guards and automatic deployment restrictions.

## Failure cases and recovery
| Failure | Detection | Impact | Recovery | Automated test |
|---|---|---|---|---|
| Native image mismatch | binary versions/fixture decode | images/security | reject artifact, clean install | image regression |
| Map worker/WebGL unavailable | worker/render/fallback test | manager map | visible fallback, preserve zone controls | browser |
| CSS drift | baseline computed styles/screenshots | all UIs | explicit v3 compatibility | browser |
| Prisma config regression | config/generate/DB suites | build/transactions | reject override; reviewed alternative | compatibility/DB |
| Lint coverage lost | config/rule parity | quality gate | restore every enabled rule | RuleTester |
| Remaining/new advisory | strict audit JSON gate | incomplete milestone | investigate, no exceptions | CI |

## Implementation sequence
1. Preserve baseline and coordinate menu task; isolate checkout.
2. Compatible Next/Sharp/Vitest/Twilio transitives/source-map patches; compatible brace versions; CDK2.273.0 fixes its bundled copy without cross-major overrides.
3. Qualify Prisma config override; migrate MapLibre worker/types and fallback.
4. Migrate Tailwind preserving v3 appearance; remove obsolete vulnerable tooling.
5. Remove Next lint fast-glob dependency with licensed minimal source adaptation and native flat composition preserving rules.
6. Strict audits, clean install, type/lint/tests/DB/browser/safe build/offline infrastructure verification.
7. Review diff, record evidence, integrate with latest main without unrelated staging, push non-force; verify main/origin/main.

## Automated verification
Planned: npm ci; npm ls --all; Prisma generate/validate; typecheck; lint; full Vitest; disposable DB; browser and reservation/drinks regressions; safe build; strict production/full audit JSON; image/SMS/config/lint compatibility; offline CDK synthesis; git diff --check. Record executed results below, never borrow historical passes.

## Manual verification
| Test | Environment | Preconditions | Expected | Evidence | Status |
|---|---|---|---|---|---|
| Before/after appearance | local isolated browser | baseline/new builds | unchanged UI | pending | NOT_RUN |
| Real production/device smoke | separately authorized release | release approval | behavior preserved | outside security task | NOT_RUN |

## Acceptance criteria
- [ ] Both audits zero at every severity; install valid.
- [ ] Relevant AC-G01/G02/G05/G06/G07/G09 regressions pass.
- [ ] Appearance and protected menu/reservation/drinks behavior preserved.
- [ ] No audit suppression, removed lint coverage or unqualified overrides.
- [ ] Documentation/evidence/diff review complete.
- [ ] Security commit on main and origin/main; unrelated work preserved.

## Rollback and deployment considerations
Revert scoped code/dependency commit and regenerate client as one artifact; no data rollback. Vulnerable baseline rollback is emergency containment only. Existing publication/ordering guards retained. Vercel's configured build migrates: any future release reviews pending migrations separately. No security publication.

## Verification findings resolved
- Rebuilt the graph with npm11.8 after npm10's optional-peer crash; pinned untouched direct versions to preserve React/Supabase/Twilio/AWS runtime behavior.
- Native lint keeps exact prior 98 TS/TSX and75 JS/MJS rules/options/severities; only root-discovery semantics and one comment whitespace change differ from upstream dist.
- Patched CDK library is required for its bundled brace dependency; CLI unchanged and offline52-resource semantics preserved.
- Tailwind v3 palettes/fonts/shadows/radii, responsive font-size resets, sibling spacing/dividers, select padding, hover/ring/outline defaults retained; actual public computed-style comparison zero across10 page/viewport combinations.
- MapLibre6 worker must be bundled explicitly for Next chunk layout; tested real ESM worker and deterministic tiles plus visible failure handling.
- Cold-route test races fixed by awaiting and checking real mutation responses, retaining the300ms optimistic-close assertion. Driver multi-route test has a60s harness budget; business deadlines remain unchanged.
- Clean verification supplies non-production Supabase placeholders for disposable DB tests and loopback datasource URLs only for schema validation. Production env validation is unchanged.
- Browser test harness now owns a direct Next process group and closes fake-auth keep-alive connections during teardown; interrupted-run fixture leaks were removed, preserving unrelated Docker builders.
- Six locked optional WASM orphan artifacts were preserved outside the isolated native install after npm ci/prune labelled them extraneous. Portable lock metadata is retained; final installed graph and repeated native tests are clean. Root image-worker install was not modified.

## Progress log
| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-10-14 | User authorizes full execution and main/origin integration; isolated worktree and menu coordination | status/read-thread | no deployment authorization |

## Final handoff
Pending implementation and verification.
