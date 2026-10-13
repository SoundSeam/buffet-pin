# Ordering Experience Rework Execution Plan

## Milestone

- Number and name: Post-M11 ordering experience rework
- Status: `CODE_COMPLETE`
- Branch: current user worktree
- Owner: Codex with Buffet Pin owner direction
- Started: 2026-08-13
- Last updated: 2026-08-13

## Goal

Replace the fragmented routine ordering workflow with the confirmed customer → Kitchen Controller → driver experience in `ORDERING_EXPERIENCE_VISION.md`. One controller must be able to receive, accept/refuse, prepare, mark ready, review a proactive delivery recommendation, physically hand off, and dispatch an order from one console. The driver must receive one ordered run, complete one current stop at a time, record arrival and private photo proof, and finish with the next stop or return guidance. Customer status and durable SMS/email notifications must reflect those physical facts.

Reservation schema, routes, components, reminder scheduling, and existing reservation rows are a protected boundary and must remain unchanged and preserved through migration verification.

## Current behavior

- `/admin/orders`, `/admin/production`, `/admin/dispatch`, and `/admin/orders?view=attention` divide one person's routine work across separate pages.
- `lib/orders/production.ts` preserves paid/printed production transitions and per-item packing evidence, but the UI exposes each internal transition.
- `lib/orders/batching.ts` generates same-zone route candidates only after a driver is selected by the current dispatch screen.
- `lib/orders/run-operations.ts` separates run creation, staff bag verification, driver pickup, and per-stop en-route/delivered actions.
- `components/driver/driver-runs-page.tsx` exposes equivalent controls for all stops and has no arrival or proof step.
- `lib/orders/notifications.ts` has durable SMS delivery and an `EMAIL` enum but no email transport path.
- M11 supplies durable async jobs, exact scheduled deadlines, recovery, and realtime invalidation infrastructure.

## Required behavior

- Authoritative 12-minute paid-order response deadline, prominent recoverable alarm, safe refusal/timeout refund, two-miss intake pause, and audited manual resume.
- One four-lane Kitchen Controller console: New, Preparing, Ready for delivery, and Handed to driver.
- One visible ready action that preserves packing verification and internal audit facts.
- Proactive cross-driver recommendations with safe capacity, zone, shift, readiness, wait, deadline, and routing constraints.
- One physical-handoff dispatch command that revalidates and transfers ownership exactly once.
- Enforced driver current-stop sequence with maps handoff, arrival, private proof, idempotent finalization, next stop, and return guidance.
- Fact-based customer status plus independently durable SMS and email intents.
- Existing payment, printing, refund, provider, audit, concurrency, security, and online-ordering invariants remain binding.

## Scope

### In scope

- Order-domain schema, services, projections, APIs, admin/controller UI, driver UI, customer status projection, notification providers, async deadline processing, tests, and launch documentation.
- Replacement or removal of legacy routine order UI and fake/test order compatibility where it reduces complexity.
- Additive order migrations and order-only compatibility changes.

### Out of scope

- Any reservation schema, reservation route, reservation component, reservation reminder, reservation data, or reservation policy change.
- Enabling production ordering, charging/refunding real cards, mutating Clover production, deploying, or approving unresolved legal/privacy/business gates.
- Customer pickup, scheduled orders, marketplace couriers, live GPS, and built-in turn-by-turn navigation.

## Dependencies

- Prior milestones: M0–M11 repository foundations.
- External services or credentials: Clover, exact printer, routing, SMS, email, and private proof storage remain provider/manual gates; deterministic fakes cover normal automated verification.
- Business decisions: reversible pilot defaults are recorded in `DECISIONS.md`; photo/customer policy remains disabled from production until approved.
- Manual/hardware gates: alarm audibility, printer/ticket/bag flow, representative kitchen device, driver phone, photo policy, roads, provider email, and production smoke.

## Assumptions

- The existing `OPERATOR` database role becomes the Kitchen Controller role in product language and receives narrowly separated intake and dispatch-handoff capabilities, without arbitrary refund/settings/catalog/reporting authority.
- Acceptance begins at authoritative `PAID`; its initial window is 12 minutes; two consecutive timeouts pause effective intake; successful acceptance resets the streak; explicit refusal does not increment it.
- Preparation extensions are bounded to 5, 10, or 15 minutes per action and require a reason.
- Private proof retention defaults to 30 days in configuration. Production ordering remains disabled pending owner/privacy approval and the launch gates.
- Google Maps universal directions links are the initial maps handoff.
- Email uses a narrow provider interface with a deterministic fake and fail-closed production configuration.

## Expected change surface

### Files and modules

- `prisma/schema.prisma` and one new migration.
- New/updated order lifecycle, controller projection, dispatch recommendation, run-operation, proof, notification, async-job, authorization, and provider modules under `lib/`.
- New/updated controller, driver, and customer route handlers under `app/api/`.
- `/admin/orders` and shared admin navigation; legacy production/dispatch pages become redirects/support-only surfaces.
- Driver runs and customer status components.
- Unit, database, integration, browser, failure, and migration tests.
- Launch plans, decisions, acceptance criteria, external gaps, and implementation ledger.

### Database changes

- New order response-deadline and decision fields.
- New intake pause/streak settings.
- New handoff/dispatch evidence fields.
- New arrival state/timestamp.
- New private delivery proof persistence with configurable retention.
- Required uniqueness/index constraints for deadline, controller mutation, handoff, proof, and idempotency invariants.
- No reservation table/type/trigger/index mutation. Static migration tests and a disposable reservation sentinel verify the protected boundary; production still requires a before/after deployment query.

### API changes

- Controller projection and commands for accept, refuse, add time, ready, recommend, handoff/dispatch, and resume intake.
- Driver current-stop, arrival, proof upload/finalize, and exception commands.
- Server-side authorization, request keys, compare-and-swap or serializable concurrency, and audit evidence on every privileged mutation.
- External calls remain outside long database transactions; notification/proof/provider work uses durable intent and reconciliation.

### UI changes

- Customer: confirmed five-state status language and aligned estimates.
- Order controller: one alarm-capable four-lane console with one next action per order.
- Dispatcher: folded into the controller's Ready lane and physical handoff action.
- Driver: one current stop and one primary action at a time.
- Manager/reporting: supporting surfaces remain separate and retain permissions.

## Security and privacy

- Server routes enforce controller and driver capabilities; hidden controls are never the authorization boundary.
- Proof is private, stop-bound, authenticated, excluded from public projections, size/type constrained, and audited.
- No raw card data enters Buffet Pin servers.
- Shared-device behavior does not erase authenticated actor evidence.
- Reservation PII and data are not read, rewritten, or migrated by this rework except in isolated preservation verification.

## Failure cases and recovery

| Failure | Detection | User/staff impact | Recovery | Automated test |
|---|---|---|---|---|
| Accept races timeout | Conditional update/serializable retry | One outcome wins | Loser reloads authoritative state | Yes |
| Deadline job repeats | Dedupe key and state guard | No duplicate refund/pause | Return prior result | Yes |
| Alarm/realtime disconnects | Server deadline remains authoritative | Live invalidation may pause | Visibility-aware polling/reload and browser notification fallback | Yes |
| Ticket is failed/unknown | Print state projection | Accept/start blocked | Inline explicit print recovery | Yes |
| Route provider fails | Provider result normalization | Manual safe recommendation | Deterministic same-zone order | Yes |
| Handoff repeats/races | Request key and active-assignment constraints | One run/ownership transfer | Return prior result/conflict | Yes |
| Proof upload fails/unknown | Proof state and object confirmation | Delivery cannot finalize | Retry/replace proof without false delivery | Yes |
| SMS/email fails | Durable notification state/alert | Delivery truth remains correct | Retry/reconcile transport | Yes |
| Driver goes offline | Current-stop server projection | Actions queue visibly fail | Reload/retry; no optimistic false completion | Browser/failure test |
| Migration affects reservations | Before/after row checksum in disposable DB | Release blocked | Fix migration; never deploy | Yes |

## Implementation sequence

1. Add lifecycle schema, migration, projections, capabilities, and async job kinds.
2. Implement acceptance/refusal/timeout/pause/resume and preparation-time services.
3. Implement ready orchestration and consolidated controller projection/routes.
4. Implement proactive cross-driver recommendations and atomic physical handoff.
5. Implement current-stop/arrival/proof/finalization domain and routes.
6. Implement private proof provider and durable email provider paths.
7. Replace controller and driver UI; align customer status and navigation.
8. Add comprehensive verification, protected reservation migration test, and documentation evidence.

## Automated verification

- Unit tests: lifecycle projection, capability matrix, countdown/pause policy, batching ranking, current-stop selection, proof validation, email normalization.
- Integration/database tests: deadline races, refund idempotency, ready orchestration, handoff concurrency, stop order, proof finalization, notification idempotency, reservation preservation.
- Contract tests: fake email and private-proof provider outcomes.
- Browser tests: controller alarm/lanes/actions, dispatch handoff, focused driver proof flow, customer status, responsive and direct-route authorization.
- Failure injection: realtime/poll, routing, proof, notification, duplicate deadline and mutation paths.
- Commands: Prisma generate/validate, typecheck, targeted and full tests, lint, safe build, database migration suite, browser suite, security audit.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
| Alarm audibility and wake behavior | Representative kitchen tablet/laptop | Browser permissions and volume configured | New paid order is unmistakable for the full response window | Recording/checklist | NOT_RUN |
| Complete controller flow | Restaurant station with exact printer | Fake/sandbox paid order and ticket | One person completes alarm through handoff without legacy pages | Recording/checklist | NOT_RUN |
| Driver proof flow | Representative driver phone | Approved private proof policy/storage | One-, two-, and four-stop runs enforce focus and proof | Recording/checklist | NOT_RUN |
| Email delivery | Approved provider/sender | Sandbox recipient | Expected messages arrive once and failure is visible | Provider evidence | NOT_RUN |
| Reservation preservation | Production deployment review | Backup/restore evidence | Reservation count/data unchanged | Before/after signed query | NOT_RUN |

## Acceptance criteria

- [x] Scoped deliverables implemented.
- [x] Applicable repository-verifiable launch and `ORDERING_EXPERIENCE_VISION.md` criteria satisfied.
- [x] Automated checks pass.
- [x] Authorization and audit behavior verified in code and automated tests.
- [x] Failure states are visible and recoverable in the repository implementation.
- [x] Reservation schema/data protection is proven statically and in disposable PostgreSQL; production before/after evidence remains manual.
- [x] Documentation and status ledger updated.
- [x] Diff reviewed for correctness, security, concurrency, and missing tests.
- [x] Remaining external/manual gates explicitly recorded.

## Rollback and deployment considerations

- Production ordering remains guarded by the existing online-ordering switch and go-live checklist. This task did not enable or deploy it.
- Additive fields remain compatible with the prior data model. Rollback is a previous application deployment; the additive migration can remain in place while proof bytes can be purged under retention policy.
- Fake order rows may be removed independently, but no migration truncates shared customer, menu, settings, staff, reservation, or reservation-support tables.
- Production ordering remains disabled until the existing go-live checklist and new experience rehearsal are complete.

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
| 2026-08-13 | Owner authorized complete order-domain rework and destructive replacement of fake/test order behavior, while explicitly protecting all reservation data and behavior. | Repository/status/domain audit started. | Reservations are a hard protected boundary. |
| 2026-08-13 | Added paid-order deadlines, one expiry job, two-miss pause/resume, idempotent acceptance/preparation extensions, internal ready/packing orchestration, and refund-bound timeouts. | Prisma validation, unit and disposable database concurrency tests. | Successful acceptance resets the miss streak; explicit refusal does not increment it. |
| 2026-08-13 | Replaced routine Orders/Production/Dispatch navigation with one four-lane Kitchen Controller and proactive cross-driver recommendations; physical handoff is the ownership/customer-truth boundary. | Authenticated Chromium alarm-to-handoff test and run replay tests. | Legacy page URLs redirect; recovery remains available for a partially planned run. |
| 2026-08-13 | Rebuilt the driver app around one current stop, maps, arrival, private proof, proof-gated finalization, next-stop focus, and return guidance. Added independent durable email delivery. | Browser proof flow, scoped-run/sequence/proof/retention DB tests, email transport test. | Customer proof visibility remains disabled/undecided. |
| 2026-08-13 | Audited the migration and workflow against the protected reservation boundary and completed safe build/document reconciliation. | Migration contains no reservation DDL; reservation sentinel survives order timeout and controller browser flow; typecheck/lint/unit/database/browser/build gates pass. | Production before/after reservation query and all physical/provider gates remain manual. |
| 2026-08-13 | Hardened the full-screen alarm lifecycle after operator UX review: live alarms close immediately during a decision, failed decisions restore the alarm with the server error, and expired alarms become dismissible missed-order acknowledgements without removing queue/server truth. | TypeScript and targeted ESLint pass; 229 unit tests, all 16 Chromium workflows, and the 60-page safe build pass. | A genuinely live unanswered order remains intentionally non-dismissible. Reservations remain outside the change boundary. |

## Final handoff

- Files changed: order lifecycle/schema/migration, async deadline processing, controller/dispatch/proof/notification services and routes, admin/driver/customer projections and UI, authorization/navigation, tests, environment contract, and launch documents. Reservation implementation files were not changed by this rework.
- Migrations: `20260813170000_ordering_experience_rework`; additive and order-only, with no reservation table/type/index/trigger statement.
- Tests added: ordering boundary/unit checks; database lifecycle, concurrency, handoff, proof, retention, email, and reservation preservation; authenticated controller/driver browser workflows.
- Commands run: Prisma format/validate/generate, TypeScript, ESLint, unit suite, disposable PostgreSQL suite, Chromium suite, and safe optimized production build.
- Review findings and resolutions: removed a stale driver import and alarm-effect dependency; routed legacy dispatcher access to driver support; added stable request-key idempotency for repeated preparation extensions and channel-specific delay notifications; hardened settings-row locking; kept proof bytes out of every API/public projection.
- Remaining manual verification: alarm audibility/wake behavior, exact printer and physical controller/bag handoff, driver phone/camera, real routes, SMS/email sender/delivery, proof privacy/retention/failed-delivery policy, production reservation before/after query, controlled payment/refund, and signed go/no-go.
- Known risks: external/provider/device/privacy gates in `KNOWN_EXTERNAL_GAPS.md`; production ordering stays disabled.
- Recommended next action: rehearse the complete fake/sandbox flow on the representative kitchen and driver devices, approve the proof policy, then execute the existing on-site evidence checklist without enabling public ordering.
