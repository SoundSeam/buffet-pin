# Manual, Hardware, and Launch Test Plan

This plan verifies facts that automated tests cannot. It is not a substitute for the automated criteria in `ACCEPTANCE_CRITERIA.md`. Run destructive or real-money scenarios only in the named approved environment and with the accountable manager present.

## Test record rules

For every run capture: test ID, acceptance IDs, date/time/timezone, environment and merchant, release commit/build, tester, witnesses, device/browser, exact SP700-family submodel/interface, inputs, expected/actual result, redacted evidence location, defect ID, retest, and approval.

Never capture card numbers, security codes, OAuth/access tokens, full customer addresses, phone numbers, or production credentials. Use designated test accounts, test addresses, low-value products, and consenting internal recipients.

For the owner-approved live MT-202/203 path, use `https://buffetpin.com/dev/machine-test` and keep public ordering off. **Run live test** requires real providers and production Clover, makes a read-only request to the live merchant, and gives that manager browser one audited 15-minute pass for exactly one checkout. The pass is random, HTTP-only, atomically single-use, and cannot be reused by a concurrent request. The runner snapshots existing orders, follows only the new real paid test order, and diagnoses payment, Clover-order and print states. The tester then reports whether the SP700 produced one, zero, or multiple tickets. The pass skips storefront and delivery-zone availability only: it never creates or bypasses payment, sends a second print, retries uncertainty, or resolves an order. Retain the exact physical/provider evidence required below. Other sandbox contract tests remain separate and cannot close the physical hardware gate.

## Preconditions

- Automated release checks pass for the candidate build.
- Database backup/rollback, feature flags, and online-order kill switch are available.
- Test orders are unmistakably labeled and kitchen waste is authorized.
- Clover sandbox merchant is configured before sandbox tests.
- Production tests have written amount, time window, participants, refund/disposition, and stop conditions.
- Restaurant and technical owners are present for on-site/production tests.
- Printer paper/ribbon, Clover device, network access, staff devices, driver phone, and fallback materials are ready.
- Test data and screenshots follow the privacy rule above.

## Gate A — Staff workflow validation

| ID     | Scenario                                                                                                          | Expected result                                                                                           | Evidence                            |
| ------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| MT-001 | Manager reviews named roles and actions.                                                                          | Refund, catalog, staff, reporting, Kitchen Controller, and driver access match approved responsibility.   | Signed permission matrix.           |
| MT-002 | Order controller handles two normal paid orders and searches by number.                                           | Each order is identified, print health is visible, and valid accept/start actions are obvious.            | Screen recording/notes and timings. |
| MT-003 | Kitchen Controller verifies an order with modifiers, drink, and special instruction.                              | Checklist matches ticket/order; packing is audited and the order becomes visibly ready for delivery.      | Completed rehearsal sheet.          |
| MT-004 | Kitchen Controller reviews recommendations, verifies bags, and releases one-, two-, and four-stop same-zone runs. | Every number matches; no fifth order; manifest order is clear; dispatch occurs only at physical handoff.   | Run screenshots and staff sign-off. |
| MT-005 | Driver opens the focused run, navigates, records arrival and photo proof, finalizes, and handles one exception.    | Only assigned data is visible; after completion, the next stop or return prompt is clear.                  | Driver recording/notes.             |
| MT-006 | Unauthorized user attempts refund, menu edit, staff edit, reporting, dispatch, and unrelated driver order access. | Every prohibited action is unavailable and direct request is rejected.                                    | Redacted responses/audit events.    |
| MT-007 | Staff revoke an active staff/driver credential.                                                                   | Further privileged access is denied and revocation is audited.                                            | Before/after evidence.              |

## Gate B — Clover sandbox order, payment, and refund

| ID     | Scenario                                                                             | Expected result                                                                                         | Evidence                              |
| ------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| MT-101 | Submit representative mapped cart with modifiers, tax, fee, tip, notes.              | Local snapshots and Clover order/charge facts agree; one order number is visible throughout.            | Redacted app/Clover records.          |
| MT-102 | Valid authorization and signed webhook, including webhook delivered twice.           | One paid outcome and one initial print intent; duplicate acknowledged without side effects.             | Provider event IDs and local audit.   |
| MT-103 | Declined payment.                                                                    | No paid state, production release, or initial print; customer receives safe retry message.              | Redacted response and order timeline. |
| MT-104 | Payment request times out, then webhook confirms payment.                            | Order remains uncertain/non-cookable until confirmation; later becomes paid once with one print intent. | Timeline and job evidence.            |
| MT-105 | Webhooks arrive out of order.                                                        | Paid state does not downgrade; effects remain idempotent.                                               | Timeline.                             |
| MT-106 | Reject a paid order.                                                                 | Production stops, durable refund is attempted, result/exception is visible, customer is notified once.  | Refund/provider IDs and audit.        |
| MT-107 | Cancel a paid order through every supported cancellation entry point.                | Each uses the same refund coordinator and cannot end as silently cancelled-but-paid.                    | Scenario matrix.                      |
| MT-108 | Authorized full and partial refunds, followed by duplicate retry.                    | Amounts and remaining balance are correct; no duplicate refund; actor/reason captured.                  | Clover/local/reconciliation evidence. |
| MT-109 | End-of-day sandbox reconciliation with matched and deliberately mismatched fixtures. | Matched rows close; each mismatch is visible, explainable, and assignable.                              | Reconciliation export.                |

## Gate C — Exact SP700-family printer and Clover physical printing

Before testing, record the printer's full label (the family report alone is insufficient; for example SP712 or SP742 plus suffix), serial only if operationally permitted, interface/ports, self-test page, firmware/emulation if shown, connected Clover device model, configured order printer, and default firing device. Confirm paper and ribbon.

Record whether that Clover device belongs to the sandbox or production merchant. Run physical sandbox tests only if a sandbox device is actually associated with the SP700. Otherwise keep credentials separated and run MT-202–209 against the live path only where each real payment, outage, and refund action has explicit approval; do not claim a sandbox result proves the live printer.

| ID     | Scenario                                                                                                                           | Expected result                                                                                                      | Evidence                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| MT-201 | Use the existing merchant/Clover UI to print a known test ticket.                                                                  | Baseline proves the device and current physical path work.                                                           | Photo and configuration screenshot.                   |
| MT-202 | App creates mapped Clover order then submits Print Orders REST request after confirmed payment.                                    | Exactly one ticket emerges from the intended configured SP700-family printer.                                        | Redacted API IDs, timestamps, continuous video/photo. |
| MT-203 | Inspect ticket with multiple quantities, long item names, all modifier types, notes, accents/special characters, and order number. | Content is legible, not dangerously truncated, and usable by kitchen/packer.                                         | Ticket photo and staff sign-off.                      |
| MT-204 | Deliver duplicate payment/webhook and application retry.                                                                           | No second initial ticket prints.                                                                                     | Event/job timeline and printer observation.           |
| MT-205 | Authorized reprint.                                                                                                                | A new audited reprint occurs and staff can distinguish it from a new order.                                          | Ticket photo and audit record.                        |
| MT-206 | Disconnect/offline printer before print request, wait past documented thresholds, then reconnect.                                  | Actual queue/email/status behavior is captured; paid-unprinted alert appears; recovery avoids accidental duplicates. | Timed video/log/email and incident notes.             |
| MT-207 | Disconnect internet or Clover device after request at the most ambiguous point safely reproducible.                                | App records `UNKNOWN` where outcome cannot be known and requires reconciliation/explicit action.                     | Timeline and recovery record.                         |
| MT-208 | Exhaust paper or simulate device error if safe.                                                                                    | Staff sees/receives failure signal, invokes fallback, restores printer, and reconciles physical tickets.             | Drill sheet.                                          |
| MT-209 | Send two paid orders close together.                                                                                               | Both print once, remain distinguishable, and maintain correct content/order numbers.                                 | Ticket pair and timelines.                            |

## Gate D — Fulfillment, routing, and field delivery

| ID     | Scenario                                                                                                                                                         | Expected result                                                                                                                                                                                                         | Evidence                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| MT-301 | Complete one-order delivery through all handoffs.                                                                                                                | Customer, ticket, bag, desk, run, driver, delivery, and receipt show the same number.                                                                                                                                   | End-to-end record.                                                                                                  |
| MT-302 | Complete four-order same-zone run.                                                                                                                               | Correct four bags/stops, reasonable ordering, no cross-assignment, and all outcomes reconcile.                                                                                                                          | Manifest, route, timestamps.                                                                                        |
| MT-303 | Attempt fifth stop and duplicate active assignment.                                                                                                              | Both are rejected without partial corrupt state.                                                                                                                                                                        | UI/API evidence.                                                                                                    |
| MT-304 | Add a different-zone order to a run.                                                                                                                             | Default rejects it or requires approved/audited override per policy.                                                                                                                                                    | Audit evidence.                                                                                                     |
| MT-305 | Hold partially filled run during low demand.                                                                                                                     | Oldest-wait/deadline rule releases it before promise risk; system never hoards indefinitely.                                                                                                                            | Timed scenario.                                                                                                     |
| MT-306 | Route provider is unavailable.                                                                                                                                   | Dispatcher can order stops manually and drivers can navigate without losing the run.                                                                                                                                    | Drill result.                                                                                                       |
| MT-307 | Driver becomes unavailable after assignment.                                                                                                                     | Dispatcher safely reassigns; old access is removed; history remains clear.                                                                                                                                              | Access and timeline.                                                                                                |
| MT-308 | Customer unreachable / address problem / failed delivery.                                                                                                        | Driver records approved exception, dispatch owns next action, customer/refund status is not guessed.                                                                                                                    | Exception workflow.                                                                                                 |
| MT-309 | Compare suggestions against dispatcher knowledge in representative traffic.                                                                                      | Suggestions are safe enough to assist; overrides and reasons work.                                                                                                                                                      | Comparison sheet and tuning decisions.                                                                              |
| MT-310 | With online ordering off, open `/admin/delivery-zones`, approve/install the four polygons, then drive one safe outer address in each zone during dinner service. | The map matches the intended neighbourhoods; Montréal/Mercier Bridge remain excluded; each test address prices into the expected zone; actual restaurant-to-door time supports or corrects the target, fee and minimum. | Signed map screenshot, four redacted address/postal results, departure/arrival times, changes and manager approval. |

## Gate E — Failure and recovery tabletop

| ID     | Failure                                 | Required demonstration                                                                                                   |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| MT-401 | App/API unavailable                     | Kill switch or ordering closure, identification of already-paid orders, paper/phone escalation, recovery reconciliation. |
| MT-402 | Restaurant internet unavailable         | No false success; staff inventory of printed/paid orders; hotspot/manual policy; post-recovery reconciliation.           |
| MT-403 | Clover unavailable or payment uncertain | Kitchen does not cook uncertain orders; provider check/reconciliation and customer messaging.                            |
| MT-404 | Printer unavailable                     | Paid-unprinted alert, controlled manual ticket, explicit recovery/reprint decision, duplicate prevention.                |
| MT-405 | Staff device unavailable                | Alternate terminal/paper log with order number and later audited data recovery.                                          |
| MT-406 | Routing/maps unavailable                | Dispatcher orders stops manually and shares approved navigation details.                                                 |
| MT-407 | SMS unavailable                         | Operational flow continues; status page/support response remains available.                                              |
| MT-408 | Refund fails or remains pending         | Order is retained in exception queue, customer receives accurate message, manager follows provider escalation.           |
| MT-409 | Database restore exercise               | Restore target and recovery point are demonstrated in an isolated environment, followed by intent reconciliation.        |
| MT-410 | Support owner cannot respond            | Backup contact assumes responsibility using access roster and incident log.                                              |

## Gate F — Controlled production smoke

Run only after Gates A-E pass or have accountable, time-bounded waivers.

1. Disable public discovery/order access or restrict to approved testers.
2. Confirm release/build, production flags, alert delivery, support roster, Clover merchant, printer, and kill switch.
3. Place one low-value authorized delivery order using a consenting internal customer and real eligible address.
4. Confirm one charge, one Clover order, one physical ticket, correct content/number, packing, desk placement, one-stop run, delivery, digital receipt, and customer notification.
5. Confirm the order appears correctly in daily reconciliation and provider reporting.
6. Separately prove a production refund using a pre-approved test if refunding the delivered smoke order would make the flow incoherent.
7. Remove test artifacts only through normal audited workflows. Never edit financial history directly.

Immediate stop conditions: duplicate charge or initial ticket, paid order missing from operations, unpaid ticket, wrong totals/customer/order, inaccessible kill switch, unauthorized privileged action, unresolved payment/refund ambiguity, material personal-data exposure, or inability to reconcile the smoke order.

## Sign-off

The launch reviewer records each required test as pass/fail/waived, links defects and retests, and maps it to `KNOWN_EXTERNAL_GAPS.md`. Required signers: business/restaurant owner, operational manager, technical owner, and accounting/legal reviewer for receipt/tax criteria. Go-live requires the `MASTER_PLAN.md` go/no-go criteria, not merely completion of this document.
