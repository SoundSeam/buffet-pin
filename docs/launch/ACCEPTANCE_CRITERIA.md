# Launch Acceptance Criteria

Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `CODE_COMPLETE`, `MANUAL_VERIFICATION_REQUIRED`, `VERIFIED`, `FAILED`, `WAIVED`, `NOT_APPLICABLE`.

An automated pass proves only the software behavior under test. Anything involving Clover merchant configuration, the physical SP700-family kitchen printer, staff, roads, legal/accounting review, or production must retain the appropriate manual status until evidence is attached. A waiver requires an owner, date, reason, expiry/review date, and compensating control.

## Global release criteria

| ID | Criterion | Evidence class | Milestone |
|---|---|---|---|
| AC-G01 | A clean checkout can install, lint, type-check, test, migrate an isolated database, and build non-interactively from documented configuration. | Automated | M0, M10 |
| AC-G02 | Production validation rejects test bypasses, unsafe defaults, and missing required secrets. | Automated | M0, M9 |
| AC-G03 | Every paid order is either visibly moving through printing/production/delivery or present in an exception queue with an owner. | Automated + staff rehearsal + pilot | M3-M10 |
| AC-G04 | The same immutable operational order number appears to customer, staff, kitchen ticket, bag/desk, driver, refund, and reconciliation views. | Automated + physical | M1, M3, M4, M6, M8 |
| AC-G05 | Payment, print, production, dispatch, refund, and notification facts are independently represented and audited. | Automated + review | M1-M9 |
| AC-G06 | Retried or concurrent requests cannot create a duplicate charge intent, initial print intent, active delivery assignment, refund intent, or notification intent. | Automated concurrency/contract | M1, M3, M6, M8 |
| AC-G07 | Privileged actions are authorized on the server and record actor, time, reason where required, and state change. | Automated + access review | M4, M5, M8, M9 |
| AC-G08 | Every launch-blocking failure has detection, a named operational owner, a recovery action, and a rehearsed fallback. | Failure injection + tabletop | M9, M10 |
| AC-G09 | Ordering can be disabled without losing paid orders or durable work, and can be restored using a documented procedure. | Automated + rehearsal | M9, M10 |
| AC-G10 | No unresolved unknown exists for money, kitchen printing, refunds, or end-of-day reconciliation at go-live. | Manual review | M10 |

## M0 — Baseline and testability

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-001 | `lint`, type-check, unit/integration tests, and production build are non-interactive and documented. | Run from clean checkout in CI-like environment. |
| AC-002 | Tests use an isolated database and cannot mutate production or developer data. | Config guard test and clean database run. |
| AC-003 | Payment, Clover order/print, routing, geocoding, SMS, and failure states can be exercised with deterministic fakes. | Automated contract scenarios. |
| AC-004 | Fakes simulate success, terminal failure, transient failure, duplicate callback, timeout/unknown, and recovery where meaningful. | Automated tests. |
| AC-005 | Fake/test/failure-injection modes cannot be enabled in production. | Environment validation tests. |
| AC-006 | One complete fake order reaches delivered and one injected failure reaches a visible recoverable exception. | Browser/integration test plus manual local run. |

## M1 — Domain and persistence

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-101 | `orderNumber` is immutable, unique in its defined scope, human-readable, and separate from the high-entropy public tracking credential. | Model/service tests and API security test. |
| AC-102 | Historical orders remain readable after additive migration and backfill. | Migration test against representative fixture. |
| AC-103 | Order snapshots preserve delivery zone, item/modifier names and prices, tax, fees, tip, totals, and promise/deadline facts. | Persistence tests. |
| AC-104 | Payment, print, production, refund, and dispatch state transitions reject invalid or stale transitions. | State-machine/concurrency tests. |
| AC-105 | Exactly one initial print intent can exist per order; labeled reprints remain separate and actor-attributed. | Uniqueness/concurrency tests. |
| AC-106 | A delivery run cannot exceed four active stops or give one order two active run assignments. | Database/service concurrency tests. |

M1 repository evidence (2026-07-22): AC-101–106 are `CODE_COMPLETE` through `tests/unit/order-domain.test.ts`, `tests/database/m1-domain.db.test.ts`, the historical SQL fixture/verification pair, and the additive M1 migration. Manager terminology/format acceptance and physical/provider projection remain manual/later-milestone evidence and are not marked `VERIFIED`.

## M2 — Delivery catalog and mappings

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-201 | Only delivery-channel products appear in the delivery storefront. | Automated catalog projection test. |
| AC-202 | Server checkout revalidates availability, modifiers, prices, taxes, zone, fee, and minimum immediately before payment. | Integration tests. |
| AC-203 | Every pilot item/modifier/tax/order type required by the selected Clover flow has a valid provider mapping. | Sync report with zero blockers. |
| AC-204 | Missing, stale, ambiguous, or sold-out mappings fail closed and produce a manager-actionable message. | Contract and browser tests. |
| AC-205 | Clover order fixtures produce line items, modifiers, notes, taxes, and totals matching the local immutable snapshot. | Contract tests. |
| AC-206 | The manager confirms one authoritative menu-edit path; dual independent price editing is disabled or procedurally prohibited. | Signed workflow review. |

## M3 — Clover order, payment, and printing

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-301 | An unpaid or uncertain-payment order cannot submit an initial kitchen print. | Automated negative/concurrency tests. |
| AC-302 | A confirmed payment transactionally creates one durable initial print intent even with duplicate/out-of-order webhooks. | Integration/contract tests. |
| AC-303 | Clover provider order, payment, and print-event identifiers plus sanitized observations are retained for support and reconciliation. | Persistence/API review. |
| AC-304 | Print timeout after submission becomes `UNKNOWN`; it is not blindly retried as a new physical ticket. | Failure-injection test. |
| AC-305 | Failed, unknown, and aged pending print jobs appear in a paid-but-unprinted exception view and alert path. | Automated alert test + operator rehearsal. |
| AC-306 | Reprint requires authorization, reason, actor, and a ticket visibly identified as a reprint where technically possible. | Permission/service test + physical check. |
| AC-307 | A mapped Clover order created by the app physically prints once on the exact configured SP700-family printer with readable order number, items, modifiers, quantity, and instructions. | On-site evidence; required before `VERIFIED`. |
| AC-308 | Printer offline, reconnect, Clover queue/recovery, and duplicate-risk handling are observed and documented on the merchant setup. | Timed on-site fault test. |

## M4–M5 — Restaurant workflow and staff control

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-401 | Staff can locate an active order by number and see payment, print, production, refund, and dispatch exceptions without conflation. | Browser tests + rehearsal. |
| AC-402 | Only valid paid orders can be accepted/start preparation; rejected/cancelled orders are unmistakable. | Service/browser tests. |
| AC-403 | The visible ready action deliberately confirms every item/instruction and the bag number while recording `PACKED` and `AT_DISPATCH_DESK` as distinct internal facts; the UI need not expose separate routine stages. | State tests + staff rehearsal. |
| AC-404 | A cancellation/refund-required warning reaches every affected staff view and prevents silent continued fulfillment. | Integration/browser test. |
| AC-501 | Manager, operator, dispatcher, reporting, and driver capabilities match the approved permission matrix. | Permission matrix tests + manager sign-off. |
| AC-502 | Unauthorized direct API calls fail even if a client manually exposes a hidden control. | Route/service authorization tests. |
| AC-503 | Staff access can be revoked and the change is effective and audited. | Manual account test + audit record. |

## M6–M7 — Dispatch and routing

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-601 | Only eligible, normally same-zone, packed and desk-ready orders can enter an approved run, unless an audited manager/dispatcher override policy explicitly permits otherwise. | Service tests. |
| AC-602 | A run contains one to four distinct orders with stable ordered stops and a single accountable driver at departure. | Model/service tests. |
| AC-603 | Front desk verifies every bag by operational number before driver pickup. | Driver/dispatcher rehearsal. |
| AC-604 | Drivers can access only assigned active manifests and only permitted customer information. | Authorization/privacy tests. |
| AC-605 | Reassignment, cancellation, failed delivery, return, and driver-unavailable paths preserve an unambiguous order/run history. | Integration tests + rehearsal. |
| AC-701 | Batch suggestions obey hard capacity, eligibility, zone, readiness, age, and promise constraints before optimizing distance/utilization. | Fixed-matrix property/scenario tests. |
| AC-702 | Capacity, oldest-wait, deadline-risk, low-demand, and manual release rules prevent indefinite hoarding. | Deterministic time-based tests. |
| AC-703 | Dispatcher sees the reason and estimated impact, approves departure, and can override with a recorded reason. | Browser test + rehearsal. |
| AC-704 | Routing outage degrades to a usable manual ordering/navigation workflow. | Failure injection + field rehearsal. |

## M8 — Customer and money completion

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-801 | Customer status and SMS reflect confirmed facts and use the same order number without exposing internal data. | Projection/notification tests. |
| AC-802 | Notifications are idempotent and failures do not mutate operational truth. | Retry/failure tests. |
| AC-803 | Paid rejection and paid cancellation invoke the same durable refund coordinator; refund failure remains visible until resolved. | Integration/concurrency tests. |
| AC-804 | Full and permitted partial refunds require the approved capability and record provider ID, amount, actor, reason, and result. | Permission/contract tests. |
| AC-805 | Digital receipt totals exactly match stored snapshots and includes fields approved by the business's Québec accounting/legal reviewer. | Math tests + professional sign-off. |
| AC-806 | Daily reconciliation compares app orders, charges, tips, taxes, fees, refunds, and provider totals, listing every unmatched or ambiguous record. | Fixture tests + sandbox/production report review. |

## M9–M10 — Reliability and launch

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-901 | Alerts cover paid-unprinted, stuck production, late dispatch/delivery, payment/refund unknown, notification failure, catalog mismatch, and reconciliation variance. | Failure injection and alert receipt evidence. |
| AC-902 | Secret/config validation, rate limiting, access review, retention decisions, and backup/restore evidence have no unresolved launch blocker. | Security/operations review. |
| AC-903 | Staff complete printer, internet, Clover, app, routing, driver, refund, and customer-exception drills using the runbook. | Signed tabletop/rehearsal log. |
| AC-904 | Named restaurant and technical owners cover every pilot service window and can access the required support/monitoring tools. | Support roster and access check. |
| AC-1001 | Clean-checkout automated suite, migration, performance, mobile, accessibility, and rollback checks pass for the release candidate. | Release evidence bundle. |
| AC-1002 | All rows in `KNOWN_EXTERNAL_GAPS.md` are closed, deferred outside launch scope, or formally waived. | Go/no-go review. |
| AC-1003 | A low-value authorized production smoke order completes payment, one physical print, packing, dispatch, delivery, receipt, and reconciliation; refund smoke is separately proven if refunding the order would invalidate the delivery flow. | Production evidence with secrets/customer data redacted. |
| AC-1004 | Pilot limits, kill switch, rollback, support roster, and expansion/stop thresholds are approved before online ordering is enabled. | Signed go/no-go record. |

## M11 — Event-driven infrastructure

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-1101 | A business transaction durably records a unique async intent before notification, deadline, or realtime delivery is considered scheduled. | Migration review plus database idempotency/concurrency tests. |
| AC-1102 | Critical and notification work use independently bounded queues, retries, and dead letters; a duplicate delivery cannot take over or finalize another worker's lease. | Unit/database tests plus deployed SQS/Lambda smoke. |
| AC-1103 | Reservation reminders use exact one-time deadlines, cancel superseded deadlines, and retain hourly anti-entropy recovery without minute-scale table scans. | Migration/worker tests plus deployed EventBridge Scheduler smoke. |
| AC-1104 | Realtime transports only opaque invalidations; customer, driver, and staff subscriptions are short-lived and scope-authorized, and every update refetches the authorized source-of-truth projection. | Authorization tests plus deployed AppSync websocket smoke. |
| AC-1105 | Vercel assumes a least-privilege AWS role through OIDC; no static AWS access key or provider credential enters client, queue, schedule, or realtime payloads. | IAM trust/policy review, environment review, and OIDC recovery smoke. |
| AC-1106 | Fixed UI polling and high-frequency cron discovery are removed; disconnected clients use visibility-aware exponential fallback polling and hourly recovery repairs undispatched/expired jobs. | Source review, unit tests, and deployed cron/queue inspection. |
| AC-1107 | DLQ and budget alarms exist, queues can be inspected/redriven, rollback modes are documented, and a named human recipient confirms alert delivery before launch. | CloudFormation evidence plus manual SNS subscription/test. |

## Post-M11 — Ordering experience rework

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-X01 | Every confirmed paid order receives one authoritative response deadline and one durable expiry job; acceptance racing expiry produces exactly one decision. | Database trigger/migration and concurrency tests. |
| AC-X02 | Two consecutive missed acceptance deadlines enter the refund workflow, pause effective intake, survive retries, and require an audited manual resume; a successful acceptance resets the streak. | Database integration tests + controller rehearsal. |
| AC-X03 | One Kitchen Controller carries routine work from alarm through physical driver handoff without separate Production/Packing/Dispatch applications. | Authenticated browser test + representative-device rehearsal. |
| AC-X04 | One ready action records complete packing evidence; a run contains one to four eligible, normally same-zone, desk-ready orders; only confirmed physical handoff changes customer truth to `On the way`. | Database/browser tests + handoff rehearsal. |
| AC-X05 | The driver is scoped to the assigned dispatched run, cannot bypass the current stop, records arrival, and cannot finalize until private proof is durably bound to that stop. | Authorization, database, and browser proof tests. |
| AC-X06 | Delivery finalization is idempotent, focuses the next ordered stop or return guidance, and independently creates customer SMS and email intents without exposing proof bytes publicly. | Database/browser/notification tests. |
| AC-X07 | The order-only migration and workflows do not alter reservation schema, behavior, or rows. | Static migration boundary test, disposable reservation sentinel, and production pre/post deployment query. |

Repository status on 2026-08-13: AC-X01–X06 are `CODE_COMPLETE`; AC-X07 is `CODE_COMPLETE` for repository/disposable-database evidence and remains `MANUAL_VERIFICATION_REQUIRED` for the production pre/post deployment query. Physical/device/provider portions remain manual under EG-012, EG-015, EG-016–018, EG-023, and EG-024.

## Evidence record template

For each manual or external criterion, record: criterion ID, environment, date/time and timezone, build/commit, tester/owner, preconditions, exact result, redacted screenshot/log/ticket/report location, defects, retest, final status, and approving owner. Do not store card data, access tokens, customer addresses, phone numbers, or other unnecessary personal data in evidence.

## Repository evidence status — 2026-07-22

| ID | Status | Evidence |
|---|---|---|
| AC-G01 | `CODE_COMPLETE` for M0 | Clean-run workflow, non-interactive commands, exact disposable DB migration, and safe build are defined in `.github/workflows/verify.yml` and `BASELINE_TEST_COVERAGE.md`. M10 clean-release-candidate evidence remains future work. |
| AC-G02 | `CODE_COMPLETE` for M0 | Environment tests reject missing/weak/equal production secrets, HTTP app URL, fake/failure/test modes, sandbox Clover, partial Clover config, and custom provider base URL. M9 operational secret/access review remains future work. |
| AC-001 | `CODE_COMPLETE` | ESLint CLI, TypeScript, Vitest, Playwright, Prisma, and safe-build commands pass non-interactively. |
| AC-002 | `CODE_COMPLETE` | Migration harness ignores caller DB URLs and is locked to the exact disposable Docker role, password, port, database, and schema; rejection and real-migration tests pass. |
| AC-003 | `CODE_COMPLETE` | Narrow payment, Clover order/print, routing, geocoding, and notification contracts plus deterministic fakes exist. |
| AC-004 | `CODE_COMPLETE` | 216 non-database plus 38 database tests cover success, terminal, transient, offline, duplicate, timeout/unknown, recovery, token-fenced callback/Clover-order leasing, payload-bound idempotency, polygon delivery eligibility, the one-use deployed machine-test grant, and concurrency across provider operations. |
| AC-005 | `CODE_COMPLETE` | Production rejects fake providers, failure injection, ordering bypass, sandbox Clover, test currency, and API overrides; dev fake page also hard-404s in production. |
| AC-006 | `CODE_COMPLETE` | Twelve Next.js/Chromium tests exercise delivered/recoverable fake flow, real unauthenticated denials, authenticated manager/operator/dispatcher/reporting boundaries, manager pilot/busy/receipt settings, delivery-zone install/economic edits, the manager-only machine-test observer, catalog blockers, paid-stop warnings, manual route fallback approval, and driver completion. |
| AC-G03–G07 | `CODE_COMPLETE` / external evidence pending | Payment-to-print intent, immutable number, separate state dimensions, immutable external-transition audits, token-fenced callback/external-order leases, payload-bound idempotency, and server capabilities are implemented and covered by contract/database/browser tests. Clover, printer, and named-account proof remains manual. |
| AC-G08–G10 | `MANUAL_VERIFICATION_REQUIRED` | Ordering defaults closed; kill switch/capacity/alerts/reconciliation exception code exists. Signed owner, external monitoring, provider close, and go/no-go evidence is absent. |
| AC-101–106 | `CODE_COMPLETE` | Private tracking credential, daily operational identity, immutable snapshots, CAS transitions/audit, durable external intents, max-four/active-assignment constraints and historical migration fixtures pass. |
| AC-201–206 | `MANUAL_VERIFICATION_REQUIRED` | Catalog mapping/sync/fingerprint/checkout guards and historical snapshots are code-complete; merchant IDs, ownership and live sold-out procedure require EG-003–005. |
| AC-301–308 | `MANUAL_VERIFICATION_REQUIRED` | Mapped Atomic Order/pay contract, strict paid reconciliation, unique print intent, Print Orders ambiguity, paid-unprinted path, labelled physical reprint/fallback, late-confirmation duplicate-risk alert, and a manager-only PII-free single-order test runner/diagnostic are code-complete; Clover sandbox and exact SP700-family printer evidence require EG-001–008. |
| AC-401–404 | `MANUAL_VERIFICATION_REQUIRED` | Production board, paid/printed CAS gates, packing verification, distinct desk placement and unified paid cancellation/rejection refund path pass automated tests; staff/device rehearsal is absent. |
| AC-501–503 | `MANUAL_VERIFICATION_REQUIRED` | Capability matrix, server enforcement, staff lifecycle and access audit are implemented; named production accounts and revocation rehearsal require EG-011. |
| AC-601–605 | `MANUAL_VERIFICATION_REQUIRED` | Four server-enforced corridor polygons, a manager map/audited installer, atomic one-to-four stop runs, zone/shift eligibility, collision guards, bag/manifest, departure/delivery and returned-to-desk recovery are implemented; owner map/economics approval and field policies/rehearsal require EG-013–015. |
| AC-701–704 | `MANUAL_VERIFICATION_REQUIRED` | Deterministic constraints/release reasons, Google matrix contract and manual fallback pass fixtures; real route/account/threshold evidence requires EG-016/017. |
| AC-801–806 | `MANUAL_VERIFICATION_REQUIRED` | Customer status projects confirmed production/run facts and routed pickup window; notifications have monotonic callbacks and unknown recovery; paid stops atomically stage refunds; receipts and charge/refund/tip/tax/fee variance imports are implemented. Clover/SMS/payout/legal evidence requires EG-008–010/018. |
| AC-901–902 | `MANUAL_VERIFICATION_REQUIRED` | Persistent alert scanner, health/readiness, rate/capacity/kill-switch, safe config/logging and recovery procedure pass repository checks; external alert delivery, backup restore, retention/access approval require EG-019/020. |
| AC-903–904 | `MANUAL_VERIFICATION_REQUIRED` | Runbook and ordered rehearsal package exist; no staff drill or support roster evidence has been supplied. |
| AC-1001 | `PARTIAL` | Aggregate lint/type/unit/contract/browser/database/migration/Prisma/build checks pass. A clean user-worktree isolation, dedicated accessibility/performance run, and deployment rollback rehearsal remain outstanding. |
| AC-1002–1004 | `MANUAL_VERIFICATION_REQUIRED` | The ordered release package names exact evidence; external gaps, controlled production smoke and signed go/no-go remain open. |
| AC-1101–1106 | `CODE_COMPLETE` | Additive `AsyncJob` migration, token-fenced processing, SQS/Lambda delivery, one-time Scheduler deadlines, OIDC recovery, scoped AppSync invalidations, fallback polling, and hourly anti-entropy are deployed. Direct queue, recovery, deadline, and websocket smokes completed once with all queues and DLQs drained. |
| AC-1107 | `MANUAL_VERIFICATION_REQUIRED` | Three DLQ alarms, an SNS topic, a $25 tagged monthly budget, and 80% forecast/100% actual budget notifications are deployed. EG-027 remains until a human-owned inbox subscribes, confirms, and receives a test alarm. |
