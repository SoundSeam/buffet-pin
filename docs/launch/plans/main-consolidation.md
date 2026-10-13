# Main consolidation — 2026-10-13

## Milestone
- Scope: repository consolidation, no delivery launch or deployment.
- Status: VERIFIED for repository synchronization and unchanged live deployment only; future release/security gates remain open.
- Branch: main.
- Owner: Codex, authorized by user to consolidate and push while preserving current live behavior.

## Goal and current behavior
Consolidate all local source and deployment evidence onto main/origin/main with a clean working tree. Production currently serves READY deployment `dpl_FnmZX1EeGPgeiGZcDRxeaLnnQK9e`, built from `c874e11765053c75d4278aaf3fbed90e00f655d7`. Main contains newer public drinks/reservation behavior; the original checkout contains uncommitted delivery/admin implementation and an obsolete reservation constant.

## Required behavior and scope
Preserve current production deployment, reservation settings, public appearance, drinks catalog, and all inactive feature states. Preserve local delivery implementation as source, without publishing it. Merge current main public changes and retain the deployed database-backed reservation switch instead of the obsolete constant. Consolidate documentation-only branch tips after review. Generated output and private database backups remain local and ignored.

## Dependencies and assumptions
The user explicitly authorizes pushing main and Vercel deployment-control changes. No production deployment, provider action, or migration is authorized or needed. Retaining the current immutable deployment is the safest way to preserve live behavior. Other worktrees were clean at the initial audit.

## Expected change surface
- Local delivery/admin code, provider interfaces, migrations, test harness and launch documentation are preserved from snapshot commit e099ac3.
- Public reservation/navigation/drinks conflicts favor deployed main. Shared shell preserves drinks theme and local checkout language-toggle support.
- No new database migration or production database mutation. Existing migration files are preserved unchanged; compatibility is checked only in disposable local databases.
- `vercel.json`: `git.deploymentEnabled=false`; preserve main cron configuration for any future reviewed release.
- Vercel project Ignored Build Step: `exit 0`, read back after setting. Prior value was null; rollback is null.

## Security and privacy
No secrets or private release/database snapshots are committed. Full local pre-consolidation tracked/untracked file backup is stored under `.git/consolidation-2026-10-13/local-files-before.tar.gz`; generated output remains in output/. Fake providers are used for normal verification. External production behavior and launch gates remain unchanged.

## Failure cases and recovery
| Failure | Detection | Recovery |
| --- | --- | --- |
| Merge changes live behavior | Vercel deployment ID and read-only public smoke | Keep existing production aliases; do not deploy |
| Tests expose integration conflicts | Type/lint/unit/browser/disposable DB checks | Resolve on main before pushing |
| Push races another main update | Fetch/fast-forward push rejection | Merge latest origin/main and reverify |
| Future accidental Git deployment | Repository deployment flag and project ignored build step | Retain both guards until an explicitly approved release |

## Implementation sequence
1. Audit git/worktrees, live deployment and project controls.
2. Back up local files, snapshot source, fast-forward main, merge local source.
3. Resolve conflicts preserving live public behavior and local implementation.
4. Merge documentation-only branch history and update evidence.
5. Run checks; review final diff; push without force.
6. Verify clean synchronized main and unchanged production deployment.

## Automated verification
| Check | Result |
| --- | --- |
| npm ci, Node 22.23.2 | PASS; clean local dependency installation. |
| npm run lint | PASS; zero errors, 26 pre-existing warnings. |
| npm run typecheck | PASS after resolving duplicate media import and restoring settings useRouter import. |
| npm test | PASS; 276 unit/contract/integration tests across 29 files. |
| npm run test:db | PASS; 34 migrations on disposable PostgreSQL, historical migration compatibility fixture, 49 tests across 11 files. No production DB used. |
| npm run test:browser | PASS; 23 Chromium workflows, including three new public reservation/theme regressions. Browser binary installed locally; initial missing-binary run superseded. |
| npm run prisma:validate / prisma:generate | PASS. |
| npm run build:safe | PASS; 60 pages generated with fail-closed non-production values; no migration command. |
| npm audit --omit=dev | FAIL, pre-existing dependency advisories: 1 moderate, 6 high, 2 critical. Prisma/MapLibre fixes propose incompatible version changes; no unrelated upgrades attempted. This is a future release/security gate, not a change to the pinned live deployment. |
| git diff --check | PASS after preserving snapshot then cleaning inherited whitespace. |

Legacy reservation/drinks database suites retain their explicit local-only fixture harnesses and were not rerun here. Their unit tests are included in npm test; shared migration/database and browser integration suites pass. Old live drinks fixture tests initially fail because they assert 15 drinks while the existing live catalog now has 17; no live data was changed to satisfy that stale assumption. A read-only smoke matching the current catalog passes at 390/768/1440px with all 17 images loaded, translation, no overflow, and original 6–12 reservation choices. Logs/screenshots are in /tmp/buffet-pin-consolidation-*.log and /tmp/buffet-pin-live-*.

## Manual verification
Read-only HTTP checks PASS for /, /drinks, /reservation, /order, /admin/login, and /api/reservations/status. Reservation availability remains true. Read-only browser smoke PASS at 390/768/1440px: all 17 current drink images decode, the catalog count is stable across translation, pages fit viewport, and public reservation choices remain 6–12. Production mutation test was skipped. Initial Vercel API identity is READY dpl_FnmZX1EeGPgeiGZcDRxeaLnnQK9e at c874e11; post-push identity check PASS: same READY deployment, same public aliases, same project ignored-build guard. No new deployment appeared in the project latest-deployment readback. No hardware/provider/rehearsal gate is completed by this task.

## Acceptance criteria
- [x] Local source preserved and conflicts resolved.
- [x] Automated checks pass or precise limitations recorded.
- [x] Local main and origin/main match; working tree clean after successful non-force push.
- [x] Production deployment unchanged; inactive features remain inactive.
- [x] Status/decisions updated; remaining launch gates remain open.

## Rollback and deployment considerations
Git history retains snapshot and all merged branch tips. No force push or branch deletion. Reenable automatic Git deployments only after a separately approved release: remove/set the repository deployment flag and clear the project Ignored Build Step via Vercel. A manual CLI production deploy bypasses these guards and requires explicit release approval. Existing live crons/settings continue with the pinned deployment; no environment variable or data change.

## Progress log
- Initial audit: original checkout dirty; seven other worktrees clean; production matches origin/main.
- Local backup and source snapshot completed; project ignored build step confirmed as exit 0.
- All local branch tips integrated; no local branch remains unmerged into main. Code, type/lint/test/database/browser/build verification complete; security advisories and stale external fixtures explicitly recorded.

## Final handoff
Source integration and push are complete. Initial consolidated commit bf857df was pushed successfully with no force; local main/origin/main matched and status was clean. Post-push Vercel inspect confirms the exact pre-existing READY deployment and aliases. All local branch tips are ancestors of main; older worktrees/branches remain available and were not deleted. This final evidence-only commit is also pushed under the same publication guards. This task does not change delivery launch milestone acceptance or close external gates; dependency advisories must be addressed before a future approved release.
