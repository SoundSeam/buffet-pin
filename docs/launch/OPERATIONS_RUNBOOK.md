# Delivery Operations Runbook

Status: repository controls are code-complete; every Clover, exact SP700-family printer, staff, route, hosting, legal/accounting, and production behavior remains subject to the external gates in `KNOWN_EXTERNAL_GAPS.md`. Staff must rehearse this runbook before production ordering is enabled.

## Operational control locations

| Control                                               | URL                      | Required capability                                             |
| ----------------------------------------------------- | ------------------------ | --------------------------------------------------------------- |
| Production, packing and paid-stop warnings            | `/admin/production`      | `PRODUCTION_WRITE`                                              |
| Delivery runs, bags, route fallback and returned bags | `/admin/dispatch`        | `DISPATCH_WRITE`                                                |
| Print/refund/notification/alert recovery              | `/dev/operations`        | manager for source resolution; operators may use print workflow |
| Catalog mappings and semantic attestations            | `/dev/clover/catalog`    | `CATALOG_WRITE`                                                 |
| Daily Clover import and variance evidence             | `/dev/reconciliation`    | `REPORTING_READ`; manager to import/resolve                     |
| Driver shifts, zones, revocation and access links     | `/admin/drivers`         | `DISPATCH_WRITE` or manager as enforced by the route            |
| Delivery-zone map and safe four-zone installer        | `/admin/delivery-zones`  | `SETTINGS_WRITE` manager                                        |
| Kill switch, capacity and delivery settings           | `/admin/settings/orders` | `SETTINGS_WRITE`                                                |

Acknowledging an alert records ownership but never changes source truth. Source-managed alerts close only after the underlying Clover order, print, payment, refund, notification, route, catalog, or reconciliation condition is resolved. The duplicate-ticket-risk alert requires a manager note after the kitchen copies are physically reconciled.

Never act manually on an active Clover order intent in `PENDING`; its token-fenced submission lease must finish or expire. The operational scanner moves an aged or legacy null-token submission to `UNKNOWN`. For `UNKNOWN`, use the recovery UI: a “created” result is accepted only after the server reads the exact order through Clover and verifies its immutable operational-number note and non-tip total. Because the one-time card source is intentionally not stored, the recovered unpaid checkout is marked failed and the customer must begin a new checkout; never try to resume or print it. A “not created” result requires dated Clover Dashboard or Support evidence and a note. A deterministic unpaid `FAILED` intent may only be abandoned with a manager reason after confirming no provider payment exists; it must never be retried into an orphan Clover order. `TOTAL_MISMATCH` requires Clover/support reconciliation and must never proceed to payment or printing.

## Roles

- Manager: opens/closes online ordering, approves refunds and sensitive overrides, owns reconciliation and escalation.
- Order controller: watches paid/print exceptions, receives tickets, accepts/rejects, and releases orders to kitchen.
- Packer: verifies items/modifiers/drinks/instructions, seals and marks the bag packed.
- Front desk/dispatcher: records bags at desk, builds/approves runs, verifies driver pickup, manages exceptions.
- Driver: accepts assigned run, verifies bags, follows stop order/navigation, and records delivery or exception.
- Technical support: investigates application/integration incidents and retains only the access approved in the access register.

One person may cover more than one role, but the system action must still reflect the responsibility being performed. Refund/menu/staff permissions do not automatically follow from operational duties.

## Before opening online orders

1. Manager confirms named order controller, packer, dispatcher, drivers, technical contact, and backup contact for the service window.
2. Confirm restaurant internet, Clover device, exact configured SP700-family printer, paper/ribbon, front-desk device, staff logins, driver phones, and notification/alert channels work.
3. Run a printer health/test ticket that cannot be mistaken for a customer order.
4. Confirm delivery menu, prices, modifiers, taxes, sold-outs, hours, zones, fees/minimums, capacity limit, and driver eligibility.
   For zone changes, turn online ordering off, use `/admin/delivery-zones`, verify the four polygons and economics, install, then test representative addresses before reopening.
5. Confirm the paid-unprinted, active order, refund exception, late order, and reconciliation views are clear.
6. Confirm kill switch/busy mode and fallback paper log are accessible.
7. Manager enables the approved pilot window only after all checks pass and records opener/time.

## Normal order flow

1. Customer submits order; the app validates the delivery cart/address and creates its immutable operational order number.
2. Do not prepare food while payment is pending, failed, or unknown.
3. After payment confirmation, the system creates the kitchen print intent. Order controller watches both the printer and paid-unprinted view.
4. Order controller matches number and ticket content, acknowledges/accepts, and releases the physical ticket to kitchen.
5. Kitchen prepares. Staff record started/preparing facts; do not use driver status as a kitchen status.
6. Packer matches the operational number and verifies every item, modifier, drink, and instruction. Mark `PACKED`, seal/label the bag, then place it at the front desk and separately mark `AT_DISPATCH_DESK`.
7. Dispatcher forms a one-to-four-order run, normally within one zone. The system may recommend; dispatcher approves or overrides with reason.
8. Driver and dispatcher read back every bag number against the manifest. Record pickup/departure only after all bags are physically present.
9. Driver follows the ordered stops/navigation and records delivered or a specific exception.
10. Customer status/notifications and reconciliation are projections of recorded facts; never mark a status merely to silence a complaint.

## Order-number rule

Use the same operational order number on customer confirmation, Clover order, printed ticket, bag label, staff search, delivery manifest, support conversation, receipt, refund, and reconciliation. Never put the private tracking token on a ticket/bag or use the short number alone as public authorization.

## Ticket does not print

1. Keep the order in the paid-unprinted exception view; do not let it disappear into a verbal handoff.
2. Determine whether submission is known failed or outcome is unknown. An unknown request may already have printed.
3. Check intended configured SP700-family printer, paper/ribbon/error lights, Clover device/network, nearby tickets, and Clover observation/email/status.
4. If the initial Clover intent is known failed, use **Authorize retry** with a reason, then submit that same initial job; do not submit `REPRINT` or `FALLBACK` jobs to Clover.
5. If unknown, physically search and reconcile first. For a damaged/lost confirmed ticket, open the order detail, choose **Print labelled reprint**, enter a reason, print the visible `REPRINT` label, then confirm physical output.
6. If the initial job is `FAILED` or `UNKNOWN` and no ticket is confirmed, authorize exactly one browser fallback from the order detail, print the visible fallback label, and only then click physical confirmation. A later Clover confirmation creates a critical duplicate-ticket-risk alert.
7. Technical support investigates; manager decides whether online ordering must be paused.

## Duplicate-looking tickets

Do not prepare both. Compare operational number and reprint marking. Place suspected duplicate aside, check the print job/audit history, and ask the order controller/manager to declare which ticket is active. Record the incident; never delete payment/order history.

## Payment is uncertain

Do not print, accept, prepare, or tell the customer payment succeeded. Check provider reconciliation/webhook state. If certainty cannot be restored promptly, pause affected ordering as defined by policy and escalate to technical support/Clover. Never charge again simply because a screen timed out.

## Reject or cancel an order

1. Record the reason and whether food has started/been packed/dispatched.
2. For paid orders, use the unified cancellation/refund action; never mark cancelled and promise money separately without a durable refund record.
3. Confirm all staff/driver views show stopped/cancelled; retrieve or clearly mark any physical ticket/bag.
4. If refund succeeds, send the accurate confirmation/receipt. If pending/failed, keep it in the manager exception queue and give the customer honest timing—do not claim completion.
5. Partial refunds and overrides require approved manager permission and reason.

## Customer or delivery exception

- Wrong/missing item before departure: keep bag at desk, correct and re-verify before pickup.
- Wrong bag at pickup: stop departure and reconcile all numbers on the run.
- Customer unreachable/address issue: driver records the approved exception and contacts dispatch; dispatcher decides wait/retry/return under policy.
- A failed delivery remains in its exception run. Dispatcher must physically receive the bag, click **Confirm returned to desk**, and only then close the exception/requeue it.
- Driver unavailable: dispatcher cancels/reassigns the run and confirms old driver access is removed.
- Accident/safety issue: prioritize emergency/safety policy, then notify dispatch; never pressure a driver to interact with the app while unsafe.
- Late delivery: dispatcher contacts customer using approved wording, records reason, and escalates refund/credit decision to manager.

## Routing unavailable

Keep the same run and bag verification. Dispatcher manually orders stops using approved maps/navigation, communicates order to the driver, and records routing fallback/override. Do not exceed four or mix ineligible zones merely because the optimizer is down.

## Internet, Clover, or app outage

### Restaurant internet down

Pause online ordering if new paid orders/alerts cannot be observed reliably. Inventory all visible paid orders and physical tickets by number. Use an approved hotspot only if security/policy permits. Maintain the paper fallback log and reconcile every order after recovery.

### Clover/payment service down

Do not accept uncertain online payments or release uncertain orders. Use the kill switch/provider controls, preserve customer/order evidence, and escalate to Clover/technical support. Restaurant walk-in procedures are outside this delivery system unless separately approved.

### App unavailable

Technical support confirms health/incident. Manager pauses ordering through the available independent control. Staff fulfill only already-confirmed orders that can be safely identified from tickets/provider evidence and record every manual transition in the fallback log for later audit/reconciliation.

### AWS async or realtime transport unavailable

AWS transport never replaces the Neon business record. Pause new intake if paid work cannot be observed, then inspect the `buffet-pin-production-critical`, `buffet-pin-production-notifications`, and corresponding DLQ CloudWatch metrics in `us-east-2`. Inspect `AsyncJob` age/state and the relay/recovery Lambda logs by opaque job ID; do not paste payloads, tokens, customer data, or provider data into tickets.

- A main-queue backlog with healthy relays should drain under bounded concurrency. Do not raise concurrency during an incident until database/provider capacity is understood.
- A DLQ item requires cause identification and durable-job reconciliation before redrive. Never redrive an ambiguous payment/print/refund side effect solely because the transport failed.
- If one-time scheduling fails, the hourly recovery Lambda recreates due dispatch. A reservation reminder is not allowed to mutate reservation truth.
- If AppSync is unavailable, clients fall back to visibility-aware polling. Status remains authoritative because every refresh reads the authorized API; AppSync messages contain invalidations only.
- Roll back transport by setting `ASYNC_JOBS_MODE=inline` and/or `NEXT_PUBLIC_REALTIME_MODE=poll` in Vercel and redeploying. Preserve queues, DLQs, schedules, secrets, and `AsyncJob` rows for reconciliation. Re-enable AWS mode only after the backlog and callback path are verified.
- The alert topic is `arn:aws:sns:us-east-2:559050218020:buffet-pin-production-alerts`. Before launch, a named operational inbox must have a confirmed subscription and a recorded test alarm.

### SMS unavailable

Continue fulfillment using recorded order facts. Customer can use the status page/support channel if available. Failed notification stays an exception; staff must not change order status solely to retrigger a message.

For a deterministic failed notification, correct the cause and use **Reconcile → retry**. For `UNKNOWN`, inspect Twilio first: record the confirmed SID/status, record confirmed failure, or create an audited replacement only after attesting that Twilio did not accept the original. Never retry an unknown submission blindly.

## Paper fallback log

For each affected order record only: operational number, observed payment evidence, ticket state, current physical state, staff initials/time, run/driver identifier, customer-contact attempt category (not phone number), exception, recovery action, and reconciliation completion. Store securely, return data to the system through an approved audited process, then retain/destroy according to policy.

## Busy mode and stopping orders

Manager uses configured capacity, menu, zone, and hour controls before quality becomes unsafe. Stop new orders immediately for duplicate charging/printing, missing paid orders, unobservable payments, printer failure without controlled fallback, unsafe staffing/driver capacity, security/privacy incident, or unavailable support. Stopping intake never abandons existing paid orders.

## End of service/day

1. Confirm no paid order is unprinted/unowned and no active order/run is stranded.
2. Resolve or assign every print, payment, refund, delivery, notification, and customer exception.
3. Open `/dev/reconciliation`, import the sanitized Clover rows (IDs and cent amounts only—never card data), and compare charge, refund, tip, tax, delivery fee, currency, and provider order ID. Acknowledge each variance with an owner; resolve only with provider evidence.
4. Confirm all drivers/runs are closed, access/temporary accounts handled, and fallback paper entries entered/reconciled.
5. Review late orders, duplicate suspicions, reprints, overrides, failed deliveries, refunds, and support incidents.
6. Manager closes ordering, records closer/time, and hands unresolved items to the named next owner.

## Incident escalation record

Record incident ID, severity, start/detection time, affected order numbers (no private token), symptoms, known money/print/food/driver impact, current containment, operational owner, technical owner, provider ticket, customer communication, recovery, reconciliation, and follow-up. Never paste secrets or unnecessary personal data into chat/tickets.

## Contact and access register

Before pilot, the owner must fill and store securely outside this public document:

| Responsibility              | Primary | Backup | Hours | Contact channel   | Access verified |
| --------------------------- | ------- | ------ | ----- | ----------------- | --------------- |
| Restaurant manager          | TBD     | TBD    | TBD   | Approved register | No              |
| Order controller            | TBD     | TBD    | TBD   | Approved register | No              |
| Dispatcher                  | TBD     | TBD    | TBD   | Approved register | No              |
| Technical support           | TBD     | TBD    | TBD   | Approved register | No              |
| Clover merchant support     | TBD     | TBD    | TBD   | Approved register | No              |
| Hosting/database/monitoring | TBD     | TBD    | TBD   | Approved register | No              |

Technical support should retain least-privilege, named, revocable access to logs/monitoring, deployment/rollback, database diagnostics, and provider dashboards needed for support. Production data writes, refunds, menu changes, and staff access require their own approved capability; support status alone is not authorization.
