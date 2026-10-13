# Buffet Pin media origin isolation

## Milestone

- Number and name: Post-M11 operations — media origin isolation
- Status: `VERIFIED`
- Branch: Current user worktree; no branch change requested
- Owner: Codex with SoundSeam account owner authorization
- Started: 2026-08-20
- Last updated: 2026-08-20

## Goal

Serve Buffet Pin media from a dedicated private S3 bucket through a dedicated CloudFront distribution, with the eight source objects copied intact and no source data deleted.

## Current behavior

Eight distinct media objects are referenced from nine call sites through direct `soundseam-origin.s3.us-east-2.amazonaws.com` URLs. The source bucket now blocks public reads, so direct requests return HTTP 403. The active SoundSeam CloudFront distribution can still read the objects, but Buffet Pin has no isolated origin or CDN lifecycle.

## Required behavior

- A versioned, encrypted, public-blocked Buffet Pin bucket owns the copied objects.
- A dedicated CloudFront distribution uses signed Origin Access Control reads; S3 remains private.
- Only the eight application-referenced objects are copied, preserving keys, content types, and bytes.
- `soundseam-origin` and every source object remain unchanged.
- Application call sites use one repository-owned media manifest and the new distribution hostname.

## Scope

### In scope

- CDK resources for the bucket, OAC-backed distribution, retention policies, and outputs.
- Server-side S3 copies for the eight referenced objects.
- Byte, metadata, access-control, and HTTP verification.
- Application URL cutover and focused automated verification.

### Out of scope

- Deleting or moving source objects.
- Migrating unrelated files under `soundseam-origin/misc/`.
- Adding a custom media domain or changing DNS.
- Production deployment was initially out of scope, then separately authorized and completed as an isolated follow-up without publishing unrelated worktree changes.

## Dependencies

- Prior milestones: M11 AWS CDK stack deployed.
- External services or credentials: SoundSeam AWS account `559050218020`, region `us-east-2`.
- Business decisions: explicit owner authorization in the 2026-08-20 request.
- Manual/hardware gates: none.

## Assumptions

- Keep the existing `misc/` keys to minimize application and rollback complexity.
- Use `buffet-pin-media-559050218020`, a globally unique account-qualified name.
- Retain the bucket and distribution if the CloudFormation stack is removed.
- Use CloudFront's generated domain until a custom CDN hostname is explicitly requested.

## Expected change surface

### Files and modules

- `infra/aws/app.mjs`
- `lib/media.ts`
- Eight existing page/component call sites
- `docs/launch/DECISIONS.md`
- `docs/launch/IMPLEMENTATION_STATUS.md`

### Database changes

- None.

### API changes

- None.

### UI changes

- No intentional visual change; media URLs move to the dedicated CDN.

## Security and privacy

- S3 Block Public Access remains fully enabled.
- CloudFront receives read-only object access through signed Origin Access Control.
- TLS is required at S3 and HTTPS is redirected at CloudFront.
- The bucket is versioned and has no expiration/deletion lifecycle.
- No credentials, customer data, payment data, or private delivery proof are involved.

## Failure cases and recovery

| Failure | Detection | User/staff impact | Recovery | Automated test |
|---|---|---|---|---|
| CDK deployment fails | CloudFormation rollback/status | No cutover; current URLs remain broken | Correct the additive stack change and redeploy | `npm run infra:synth`, `npm run infra:diff` |
| Copy is partial | Destination manifest/head-object comparison | Some media returns 403/404 | Re-run idempotent copy for missing keys | S3 size/type and streamed SHA-256 comparison |
| CloudFront still deploying | Distribution status/HTTP response | Temporary 403/404 before cutover | Wait for `Deployed`; do not change app URLs early | `aws cloudfront wait distribution-deployed`, HTTP HEAD/GET |
| App cutover regresses | Type/lint/build or focused browser smoke | Missing images/video | Revert only media manifest origin to the known SoundSeam CloudFront hostname while preserving copied data | typecheck, lint, safe build, HTTP checks |

## Implementation sequence

1. Inventory hard-coded references and source object metadata.
2. Add retained private S3 and OAC-backed CloudFront resources to the existing CDK stack.
3. Synthesize and review the additive CloudFormation diff.
4. Deploy the stack, then copy only the eight inventoried source keys.
5. Verify destination sizes/content types and compare streamed SHA-256 hashes through both CDNs.
6. Replace call sites with a centralized media manifest using the new CloudFront domain.
7. Run focused and repository-level checks; update the launch ledger with live evidence.

## Automated verification

- CDK synth and diff.
- Destination S3 metadata manifest equals source for key, size, and content type.
- Public S3 object URL is denied.
- Each CloudFront object returns HTTP 200 with its expected content type.
- Streamed SHA-256 source/destination CDN bytes match for all eight objects.
- `npm run typecheck`.
- Focused ESLint for changed TypeScript files.
- `npm run build:safe`.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
| Visual media smoke | Local Buffet Pin development server | App uses new manifest | Logos/icons render and both videos play | Home: six CDN assets loaded; videos readyState 4 at 1920×1080 and 720×1280. Ordering/checkout: remaining logo and food image loaded with nonzero dimensions. | PASS |

## Acceptance criteria

- [x] Scoped deliverables implemented.
- [x] Applicable repository checks pass.
- [x] Source objects remain present and unchanged.
- [x] Destination bucket is private, versioned, encrypted, retained, and contains exactly the copied manifest.
- [x] Dedicated CloudFront distribution serves every manifest object.
- [x] Documentation and status ledger updated.
- [x] Diff reviewed for correctness, security, and unrelated changes.

## Rollback and deployment considerations

- Feature flags: none.
- Backward compatibility: source objects and the active SoundSeam CloudFront distribution remain intact.
- Data rollback limitations: none; no source data is modified or deleted.
- Operational rollback: change only `MEDIA_ORIGIN` back to `https://d24xmrrdb5gzdi.cloudfront.net`; do not delete the new bucket, versions, distribution, or source data.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-08-20 | Inventoried eight distinct objects across nine call sites; confirmed direct S3 403 and active SoundSeam CloudFront 200. | Repository `rg`, S3 `head-object`, HTTP HEAD | No blocker. |
| 2026-08-20 | Added and deployed retained private/versioned S3 plus OAC-backed CloudFront through the existing CDK stack. | `npm run infra:synth`; `npm run infra:diff` showed four additive resources and no removals; CloudFormation `UPDATE_COMPLETE`. | Distribution `E1DVTDEQ25O29`; domain `d2d93bgcpgtdom.cloudfront.net`. |
| 2026-08-20 | Copied only the eight inventoried keys and centralized all application references. | Eight metadata matches; eight SHA-256 matches; S3 403; eight CDN 200s; no remaining direct source references. | Source retained unchanged. |
| 2026-08-20 | Completed application and visual verification. | TypeScript PASS; focused ESLint PASS; all 230 non-database tests across 24 files PASS; safe build PASS; zero CDK drift; local browser media smoke PASS. | Production deployment was not included in the initial authorization. |
| 2026-08-20 | Reconstructed the exact active Vercel source snapshot, applied only the media cutover, deployed it without domain promotion, verified it, then promoted it to production under separate explicit authorization. | Hash comparison: 422 retained source files, eight intended changed call sites, one intended new manifest, zero missing files. Vercel build READY with 29/29 migrations already applied. Seven candidate and seven public route/API checks returned 200; live HTML contained all eight CDN URLs and no old S3-origin URL. | Production deployment `dpl_7P2Be37J3UobrnpooEBKbjicof9Z`; retained rollback target `dpl_AkED4BCxfynEVzuzSehi9656cK4X`. |

## Final handoff

- Files changed: `infra/aws/app.mjs`, `lib/media.ts`, eight call-site files, `tests/unit/media.test.ts`, this plan, `DECISIONS.md`, and `IMPLEMENTATION_STATUS.md`.
- Migrations: none.
- Tests added: one unit test that fixes the eight-entry manifest to the dedicated distribution and forbids the shared source name.
- Commands run: `npm run infra:synth`, `npm run infra:diff`, `npm run infra:deploy`, S3 metadata/policy/version checks, HTTP checks, streamed SHA-256 checks, `npm run typecheck`, focused ESLint, focused Vitest, `npm run build:safe`, local browser smoke, exact Vercel source reconstruction/hash comparison, isolated production build, candidate smoke, promotion, and public production smoke.
- Review findings and resolutions: removed an ineffective default-certificate TLS policy setting after CDK warned it had no effect; retained HTTPS redirect and S3 secure-transport enforcement. Confirmed the final CloudFormation diff was additive only. Because the active production deployment came from a dirty CLI source snapshot, reconstructed that immutable snapshot and verified content hashes instead of deploying the current worktree or Git branch.
- Remaining manual verification: none for this scoped migration; production application promotion and public smoke verification are complete.
- Known risks: CloudFront generated hostname is operational but not brand-owned DNS.
- Recommended next action: optional custom `media.buffetpin.com` certificate/DNS change as a separate, explicitly authorized task.
