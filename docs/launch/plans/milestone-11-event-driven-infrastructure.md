# Milestone 11 — Event-driven infrastructure

## Milestone

- Number and name: M11 — Event-driven infrastructure
- Status: `MANUAL_VERIFICATION_REQUIRED`
- Branch: `codex/admin-drinks-page` (pre-existing user branch; changes remain uncommitted)
- Owner: Codex / Buffet Pin owner
- Started: 2026-08-12
- Last updated: 2026-08-12

## Goal

Remove PostgreSQL from the role of clock, queue, retry engine, and UI change detector while keeping Neon as the transactional source of truth. Durable work is addressed by ID through AWS queues and one-time schedules, and clients receive non-sensitive invalidations instead of repeatedly loading broad database projections.

## Prior behavior

- `vercel.json` invokes reservation reminders every minute and the operational scanner every five minutes.
- `app/api/cron/send-reminders/route.ts` and `lib/reservations/reminders.ts` discover work by scanning time windows.
- `app/api/cron/operational-scan/route.ts` and `lib/operations/alerts.ts` repeatedly reconstruct operational exceptions from broad table scans.
- Admin, driver, reservation, and customer components poll rich API projections on fixed intervals.
- Provider work has durable domain intents, but hosting does not provide a general durable dispatch, lease, retry, dead-letter, or one-time deadline primitive.

## Required behavior

- Business transactions persist a unique `AsyncJob` intent before an external side effect is considered scheduled.
- AWS SQS supplies bounded concurrency, retry, and dead-letter handling; EventBridge Scheduler supplies exact one-time wakeups.
- Lambda relays invoke a signed, narrow application worker by job ID. Business rules and provider credentials stay in the existing server runtime.
- AppSync Events carries only invalidation envelopes. Every UI still performs an authorized source-of-truth fetch and falls back to bounded polling when realtime is unavailable.
- A low-frequency recovery pass repairs undispatched or expired work without returning to minute-scale table scanning.
- Online ordering remains disabled until the existing go-live checklist is explicitly completed.

## Scope

### In scope

- Additive async-job schema and migration, transactional enqueue helpers, lease fencing, recovery, and tests.
- Critical and notification SQS queues with DLQs, relay Lambdas, alarms, one-time Scheduler integration, and AppSync Events invalidations.
- OIDC-based AWS access for the Vercel runtime and signed AWS-to-app callbacks.
- Replace fixed UI polling with realtime invalidation plus exponential fallback polling.
- Remove the high-frequency Vercel cron schedules after AWS recovery scheduling is deployed.
- Deployment, smoke verification, runbook/configuration documentation, and cost guardrails.

### Out of scope

- Moving PostgreSQL, the Next.js application, payments, or provider credentials to AWS.
- RDS, DynamoDB, ElastiCache, ECS, Kinesis, Step Functions, DMS, or a NAT gateway.
- Enabling production online ordering or exercising real payments, refunds, printing, or customer notifications.

## Dependencies

- Prior milestones: M0–M10 implementation baseline and durable provider intent models.
- External services or credentials: existing AWS and Vercel CLI sessions; Neon database URL for migration deployment.
- Business decisions: none required for the reversible infrastructure boundary.
- Manual/hardware gates: real customer/staff realtime behavior and operational recovery rehearsal remain manual deployment evidence.

## Assumptions

- Vercel workload identity can assume an AWS role without long-lived access keys.
- AppSync Events is available through the CDK bootstrap deployment role in `us-east-2`.
- Lambda-to-app delivery is acceptable because it preserves one business-rule runtime and does not put raw provider secrets in AWS.

## Expected change surface

### Files and modules

- `prisma/schema.prisma`, additive migration, `lib/async-jobs/*`, internal worker/recovery APIs.
- `infra/aws/*`, CDK configuration and deployment scripts.
- Realtime token/event APIs and affected polling components.
- `lib/env.ts`, `.env.example`, `vercel.json`, operational documentation.

### Database changes

- New models/fields/enums/indexes: `AsyncJob` with unique dedupe key, state, lane, run time, dispatch/processing attempts, and token-fenced lease.
- Migration/backfill strategy: additive table only; no historical backfill is required.
- Compatibility and rollback: old cron/API behavior remains callable during deployment; feature flags allow `inline`, `shadow`, or `aws` dispatch. The table may remain unused on rollback.

### API changes

- Routes/contracts: authenticated internal job processing/recovery endpoints and authenticated realtime-token endpoint.
- Authorization: HMAC-authenticated AWS callbacks; existing customer/staff/driver authorization before channel issuance and data refetch.
- Idempotency/concurrency: unique dedupe keys, lease tokens, compare-and-set finalization, SQS partial-batch failure.
- External provider behavior: existing provider coordinators remain authoritative and idempotent.

### UI changes

- Customer, order controller/packer, dispatcher, driver, manager/reporting: realtime invalidation triggers the same authorized fetch; disconnected clients use exponential fallback polling.

## Security and privacy

- Authentication/authorization: Vercel uses OIDC to assume a least-privilege AWS role; AWS callbacks use a distinct secret; AppSync subscriptions use short-lived channel-scoped tokens.
- Sensitive data: SQS, Scheduler, logs, and realtime messages contain opaque job/entity identifiers only—no customer, address, order contents, or payment data.
- Abuse cases: callback replay, forged subscriptions, queue floods, and poisoned messages are constrained by signatures, expiry, IAM, bounded concurrency, dedupe, and DLQs.
- Audit events: business transitions continue using immutable domain audit events; infrastructure attempts are stored on `AsyncJob` and logged with job IDs.
- Secret/configuration changes: generated callback/realtime secrets in AWS Secrets Manager and matching encrypted Vercel environment values.

## Failure cases and recovery

| Failure | Detection | User/staff impact | Recovery | Automated test |
|---|---|---|---|---|
| Queue delivery repeats | duplicate delivery and job state | none or repeated coordinator call | lease/dedupe and provider idempotency | unit/integration |
| Worker times out after side effect | lease expiry / retry | state may be temporarily stale | coordinator reconciliation; never blind side-effect replay | failure injection |
| Poison job | DLQ alarm | one workflow visibly delayed | inspect job, correct cause, redrive | contract |
| AppSync unavailable | connection state | delayed screen refresh | exponential fallback polling | unit/browser |
| Job not dispatched | recovery metric | delayed workflow | hourly anti-entropy dispatches due intent | integration |
| Callback forged/replayed | signature/timestamp rejection | none | reject without acquiring job | unit |

## Implementation sequence

1. Add the durable job contract, lease/recovery logic, configuration validation, and tests.
2. Add signed internal processing and recovery endpoints.
3. Add CDK queues, Scheduler, relay/recovery/authorizer Lambdas, AppSync Events, alarms, SNS, budget, and OIDC role.
4. Migrate reminder/deadline work and event-triggered projections to job intents.
5. Replace fixed UI polling with invalidations and bounded fallback polling.
6. Deploy database, AWS stack, and Vercel configuration without enabling ordering.
7. Run automated checks and read-only smoke/recovery verification; record evidence and manual gates.

## Automated verification

- Unit tests: dedupe, lease fencing, signatures, invalidation channels, reconnect/backoff.
- Integration tests: async-job acquisition/finalization/recovery and scheduling contracts.
- Contract tests: Lambda callback and AppSync authorization envelopes.
- Browser tests: existing authorized status flows plus fallback behavior where practical.
- Failure injection: repeat delivery, expired lease, invalid signature, unavailable realtime.
- Type/lint/build commands: `npm run prisma:validate`, `npm run typecheck`, focused tests, `npm run lint`, `npm run build:safe`, and `npm run verify`.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
| Production subscription reconnect | deployed Vercel/AWS | authenticated staff/customer session | invalidation refreshes state; disconnect falls back | deployment logs/screenshots | NOT_RUN |
| DLQ alarm delivery | AWS production stack | `kookupbeats@gmail.com` subscription confirmed | test alarm reaches owner | SNS evidence | TEST_SENT_AWAITING_RECEIPT_CONFIRMATION |
| Provider workflow recovery | controlled sandbox | safe provider fixture or approved sandbox event | ambiguous/retried work reconciles once | job/audit evidence | NOT_RUN |

## Acceptance criteria

- [x] Scoped deliverables implemented.
- [x] Applicable automated criteria in `docs/launch/ACCEPTANCE_CRITERIA.md` satisfied; AC-1107 retains its named manual gate.
- [x] Automated checks pass.
- [x] Authorization and infrastructure-attempt evidence verified without weakening domain audit invariants.
- [x] Failure states are visible and recoverable through durable state, retries, DLQs, alarms, and hourly anti-entropy.
- [x] Documentation and status ledger updated.
- [x] Diff reviewed for correctness, security, concurrency, and missing tests.
- [x] Remaining external/manual gates explicitly recorded.

## Rollback and deployment considerations

- Feature flags: `ASYNC_JOBS_MODE=inline|shadow|aws` and `NEXT_PUBLIC_REALTIME_MODE=poll|appsync`.
- Backward compatibility: route contracts remain unchanged; fallback polling preserves correctness.
- Data rollback limitations: completed external side effects are never rolled back by deleting job records.
- Operational rollback: switch dispatch to `inline` and realtime to `poll`, then disable AWS event-source mappings/schedules. Keep queues/DLQs for evidence and drain deliberately.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-08-12 | Repository, Neon load paths, AWS account, Vercel project, and launch invariants audited; implementation started. | Read-only CLI and source inspection. | Shared AWS account requires strict `buffet-pin-*` isolation. |
| 2026-08-12 | Added `AsyncJob`, transactional notification/order/reservation triggers, lease fencing, signed worker/recovery routes, dispatch/recovery services, and exact reminder handling. | Migration deployed to configured Neon; all 29 migrations recorded; ordering flags stayed false. | Neon remains business truth; AWS is transport/time, not a second system of record. |
| 2026-08-12 | Deployed isolated SQS/DLQ lanes, relay/recovery/authorizer Lambdas, Scheduler group, AppSync Events, OIDC role, retained secrets, CloudWatch alarms, SNS topic, and $25 tagged budget. | CloudFormation `UPDATE_COMPLETE`; synthesis/diff and queue/DLQ inspection passed. | No static AWS key, RDS, cache, container, workflow engine, migration service, or NAT required. |
| 2026-08-12 | Configured production Vercel, removed high-frequency crons, deployed realtime/fallback clients, async dispatch, and superseded Scheduler cleanup. | Deployment `dpl_AkED4BCxfynEVzuzSehi9656cK4X` is READY and aliased to `www.buffetpin.com`; Vercel cron list is empty. | Public ordering remains explicitly disabled. |
| 2026-08-12 | Ran production-safe synthetic transport smokes. | Direct SQS, OIDC recovery, one-time Scheduler auto-delete, superseded-schedule deletion, and authorized AppSync websocket invalidation passed; synthetic records/schedules were removed and main queues plus all three DLQs returned to zero. | No provider, card, print, refund, SMS, or customer action occurred. |
| 2026-08-12 | Closed repository and deployment verification. | TypeScript; 219 non-database tests; 41 isolated PostgreSQL tests across 29 migrations; 12 Chromium workflows; lint with zero errors; safe build; zero production vulnerabilities; health/readiness; CDK synthesis/zero diff; and Vercel build passed. | A human must select/confirm the SNS alert inbox (EG-027); real provider recovery and observed load remain launch/operations evidence. |
| 2026-08-12 | Added the owner-selected alarm recipient through CDK. | CloudFormation created subscription `a39af5e6-9e93-482f-a072-c6f7d354a477`; stack is `UPDATE_COMPLETE` with zero CDK diff. | `kookupbeats@gmail.com` must click the AWS confirmation link before a delivery test can close EG-027. |
| 2026-08-12 | After owner confirmation, published one labelled delivery-test message through a temporary least-privilege CloudFormation resource and removed that resource. | Publish custom resource reached `CREATE_COMPLETE`; cleanup stack update reached `UPDATE_COMPLETE`. No queue item or application/provider workflow was created. | Inbox owner must confirm receipt to close EG-027. |

## Final handoff

- Files changed: additive async/realtime modules and routes, affected write paths and polling clients, CDK/Lambda infrastructure, environment/package configuration, and launch control documents.
- Migrations: `20260812120000_event_driven_async_jobs`, deployed additively to the configured Neon database; no destructive schema operation or historical backfill.
- Tests added: HMAC freshness/tamper/expiry and opaque realtime-channel tests; existing async/domain suites remain green.
- Commands run: Prisma generate/validate/migrate, TypeScript, unit/contract/integration/database/browser tests, lint, production security audit, safe build, CDK synth/diff/deploy, Vercel environment/deploy, AWS/HTTP/database read-only verification, and four production-safe synthetic transport smokes.
- Review findings and resolutions: dispatch happens after transactions; database triggers cover notification/order/reservation intents atomically; leases are token-fenced; AppSync payloads are opaque and subscription-scoped; Vercel uses OIDC; queues/DLQs/secrets are retained; bounded concurrency prevents a new compute storm; production ordering remained off.
- Remaining manual verification: confirm the AWS email sent to `kookupbeats@gmail.com` and receive one test alarm (EG-027); observe authenticated screens/reconnect behavior on representative devices; run provider-recovery rehearsal only in an approved sandbox; compare Neon compute over representative traffic.
- Known risks: the 34 existing operational alerts remain unresolved launch work; SNS currently has no confirmed human recipient; fallback polling temporarily increases reads during a realtime outage; infrastructure transport tests do not prove Clover, printer, SMS, staff, road, legal, or go-live behavior.
- Recommended next action: complete EG-027, then monitor Neon compute and AWS queue/worker metrics for a representative period before changing any capacity settings. Do not enable ordering as part of this milestone.
