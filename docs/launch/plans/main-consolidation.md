# Main consolidation — 2026-10-13

## Milestone
- Scope: repository consolidation, no delivery launch or deployment.
- Status: IN_PROGRESS.
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
Pending: lint, typecheck, unit/contract/integration tests, browser tests, isolated DB migrations/tests, Prisma validation, safe production build, dependency audit. Legacy reservation DB/browser suites retain their separate local-only harness; they never use production credentials.

## Manual verification
Pending: read-only live HTTP smoke, deployment/alias identity before/after, absence of new production build. No hardware/provider/rehearsal gates are completed by this task.

## Acceptance criteria
- [ ] Local source preserved and conflicts resolved.
- [ ] Automated checks pass or precise limitations recorded.
- [ ] Local main and origin/main match; working tree clean.
- [ ] Production deployment unchanged; inactive features remain inactive.
- [ ] Status/decisions updated; remaining launch gates remain open.

## Rollback and deployment considerations
Git history retains snapshot and all merged branch tips. No force push or branch deletion. Reenable automatic Git deployments only after a separately approved release: remove/set the repository deployment flag and clear the project Ignored Build Step via Vercel. A manual CLI production deploy bypasses these guards and requires explicit release approval. Existing live crons/settings continue with the pinned deployment; no environment variable or data change.

## Progress log
- Initial audit: original checkout dirty; seven other worktrees clean; production matches origin/main.
- Local backup and source snapshot completed; project ignored build step confirmed as exit 0.
- Integration and verification in progress.

## Final handoff
Pending final verification and push. This task does not change delivery launch milestone acceptance or close external gates.
