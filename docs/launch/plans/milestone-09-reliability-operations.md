# Milestone 09 — Reliability, monitoring, security, and operational fallback

## Milestone

- Number and name: M9 — Reliability, monitoring, security, and operational fallback
- Status: `MANUAL_VERIFICATION_REQUIRED` (repository controls code-complete; production monitoring/backup/staff evidence external)
- Branch: `main` (dirty user-owned worktree; no branch mutation)
- Owner: Codex
- Started: 2026-07-22
- Last updated: 2026-07-27

## Goal

Make every launch-blocking failure class persistently visible with an owner/recovery path, enforce intake controls atomically, and provide health, readiness, recovery-job, and security evidence without exposing secrets or customer data.

## Current behavior

Production configuration fails closed and ordering has a database kill switch, but checkout does not enforce active-order capacity or public rate limiting. Provider failures are durable in domain records yet there is no unified exception queue or operations health surface.

## Required behavior

Persist stable-key alerts for paid-unprinted, unknown payment/refund, stuck production, late delivery, failed notification, catalog mismatch, route exception, and reconciliation gaps. Scheduled scans are authenticated and idempotent. Online ordering and maximum-active-order controls serialize concurrent intake.

## Scope

- Persistent alerts, scan/acknowledge/resolve APIs, health/readiness, structured safe logging.
- Atomic kill switch/capacity enforcement and checkout rate limiting.
- Recovery scan cron and documented fallback/backup/retention evidence requirements.
- External monitoring vendor, production backup restore, staffing and real alert receipt remain manual.

## Dependencies

- Prior milestones: M0–M8 code surfaces.
- External: hosting monitor, backup provider, named support owners are unavailable.

## Failure cases and recovery

| Failure | Detection | Recovery | Automated evidence |
|---|---|---|---|
| Paid order lacks confirmed print | critical stable alert | pause intake, inspect/reconcile, controlled fallback | scanner fixture |
| Concurrent intake reaches cap | serialized settings lock/count | increase approved cap or close orders | DB concurrency |
| Provider/test bypass in production | startup validation | correct secret/config and redeploy | env tests |
| Scanner reruns | unique alert key | update last seen, no duplicate | DB test |

## Implementation sequence

1. Add additive operational-alert persistence.
2. Implement scanner, authorized operations API/cron, health/readiness.
3. Enforce rate/capacity/kill-switch controls and test concurrency.
4. Update security, backup/retention, fallback, and status evidence.

## Automated verification

- `npm run verify`: PASS in the M0–M10 aggregate.
- Database tests prove serialized active-order capacity under concurrent intake, stable alert deduplication and source-cleared resolution.
- Environment/security tests, authenticated cron, health/readiness, production fail-closed build and dependency audit pass.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
| Alert delivery and owner response | production-like | monitoring account/roster | alert reaches named primary/backup | alert receipt + timeline | NOT_RUN |
| Backup restore | production provider | approved snapshot | timed isolated restore and reconciliation | restore record | NOT_RUN |
| Outage tabletop | restaurant | staff/hardware | all fallback drills completed | signed rehearsal | NOT_RUN |

## Acceptance criteria

- [x] AC-901/902 repository-verifiable portions pass.
- [x] Kill switch, capacity, failure scanner, and auth tests pass.
- [x] External AC-903/904 evidence remains explicit.

## Rollback and deployment considerations

- Additive alert table. Disabling scanner does not alter domain records; intake defaults remain closed.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-07-22 | M9 plan and alert persistence started | pending | Production monitoring/backup/staff evidence external |
| 2026-07-22 | Completed persistent scanner/recovery console, source-managed alert lifecycle, duplicate-ticket and notification-creation exceptions, reconciliation suppression, health/readiness and intake controls. | Aggregate `npm run verify` passed. | Production monitoring, restore and staff drills remain external. |
| 2026-07-27 | Exposed the existing busy mode, extra-time, maximum-active-order, partial-refund and receipt identity controls on the manager settings page so the onsite pilot can be configured without direct database access. | Typecheck, lint, focused browser test and aggregate `npm run verify` passed; manager settings browser coverage now passes. | Business/legal receipt values and pilot cap still require named human approval. |
