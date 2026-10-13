# One-Day Onsite Launch Plan

This plan compresses the restaurant-only verification into one onsite day. It does not waive Clover, printer, money, staff, legal/accounting, or production evidence. The day succeeds only if the remote prerequisites are complete and the named go-live authority accepts the remaining operational risk.

Use `TOMORROW_ONSITE_CHECKLIST.md` as the plain-English execution sheet for the July 28 visit. This plan remains the detailed evidence standard.

## Known access and constraint

Reported 2026-07-27:

- The technical owner expects one day of real Clover Dashboard access.
- The technical owner has full Vercel, Supabase, Neon, and Twilio ownership.
- The printer is reported as Star Micronics SP700 series. The exact submodel (for example SP712 or SP742), suffix/interface/configuration is not yet known and will be recorded onsite.
- The technical owner will be onsite with a laptop and Codex.
- The restaurant visit is limited to approximately four to six hours.
- The onsite visit is planned for 2026-07-28. Restaurant/go-live witnesses are not yet named.

Never paste credentials, access tokens, card data, customer personal data, or complete environment files into Codex. Enter secrets directly in the provider/Vercel interfaces or through a secure local environment loader.

## Definition of a successful day

By the end of the visit:

1. The exact release build is deployed with intake initially disabled.
2. Clover catalog, payment, webhook, refund, Print Orders, and reconciliation evidence passes.
3. Exactly one legible physical ticket from the configured SP700-family printer is proven for a paid order, plus safe offline/reprint/fallback recovery.
4. Production, packing, desk, dispatch, driver, notification, receipt, and close workflows are rehearsed.
5. One explicitly authorized low-value production smoke completes and reconciles.
6. Support, monitoring, kill switch, pilot limits, and stop thresholds are live.
7. The named authority records go/no-go. Public ordering remains disabled on any hard no-go.

## Remote prerequisites — finish before travelling

### Release candidate

- Isolate the intended launch changes from the pre-existing dirty worktree.
- Create an identifiable release commit/build and run:

```bash
nvm use
npm ci
npm run verify
npm run security:audit
```

- Record the commit, Vercel deployment, migration set, tester, timestamp, and evidence location.
- Do not improvise from an uncommitted laptop-only build onsite.

### Production services

- Create/link Vercel Production, Neon runtime/direct database connections, Supabase Auth, canonical HTTPS domain, monitoring, and cron.
- Apply all migrations after taking a provider backup; complete an isolated restore before the visit.
- Provision the manager account and named operational accounts.
- Deploy with `onlineOrderingEnabled=false` and `deliveryEnabled=false`.
- Set a conservative pilot `maxActiveOrders`, menu, hours, radius/zones, fee/minimum, and busy-mode default.
- Verify `/api/health` and `/api/readiness`; readiness must report intake paused.

### Environment

Load secrets without printing their values, then run:

```bash
npm run launch:preflight:production
npm run launch:preflight:production:probe
```

For a secure sandbox/tunnel environment:

```bash
npm run launch:preflight:sandbox
```

The preflight prints variable names and failures only. It requires separate Clover Platform and Ecommerce tokens in production, both webhook credentials, Google address configuration, Twilio, distinct signing secrets, real providers, and disabled bypass/failure modes.

### Decisions and people

Obtain before the visit:

- Named restaurant go-live authority and a reachable backup.
- Refund/cancellation, delivery failure/return, proof-of-delivery, allergy/food-safety, privacy/retention, and customer-support policies.
- Québec receipt/tax/business-field approval from a qualified accountant or lawyer.
- Pilot menu, hours, delivery boundary, capacity, driver, support contact, stop thresholds, and maximum financial exposure.
- Written authorization parameters for the low-value production smoke and separate refund smoke.

If these approvals are absent, the visit may prove the system technically but cannot authorize live public orders.

## Bring onsite

- Laptop, charger, hotspot, approved test phone/card, and access to the exact release/deployment.
- Clover owner/admin login and a way to receive MFA.
- Vercel, Neon, Supabase, Twilio, DNS, Google, monitoring, and support access.
- Printer paper, ribbon, spare consumables, labels, and fallback paper log.
- Driver phone and representative operator/dispatcher device if different from the laptop.
- A secure evidence location outside the public repository.
- Contact details for Clover support, restaurant authority, and technical backup.

## The application in one sentence

A customer pays for one immutable order; the same operational number follows it through one kitchen ticket, preparation, packing, the dispatch desk, an approved driver run, delivery, receipt, support, refund, and reconciliation.

The onsite test is therefore not a tour of every screen. It is proof that this chain works once normally, then remains safe when payment, printing, people, or networks misbehave.

## Four-to-six-hour onsite script

Use a single checklist owner. Mark every gate `PASS`, `FAIL`, or `NOT RUN`, attach redacted evidence, and keep public intake disabled until the final decision. The first four hours prove the minimum launch chain. The remaining two hours provide recovery confidence, retesting, and a controlled production smoke.

### 00:00–00:20 — Establish the exact system under test

- Record the release commit/deployment, merchant/environment, tester and witnesses.
- Confirm production intake is disabled.
- Run the production preflight probe; verify health, readiness, monitoring, kill switch, pilot cap, backup/restore evidence and support contacts.
- Stop if release identity, rollback, authority, or critical monitoring is missing.

### 00:20–00:50 — Prove the printer before touching money

- Photograph or transcribe the back/bottom label and rear ports. Record the full SP700-family model/submodel/suffix/interface, connected Clover device, paper/ribbon, printer association and default firing device.
- Produce the model's self-print/configuration ticket using the applicable Star manual. On current SP700-series documentation this is entered by powering on while holding **FEED**, then releasing after the first buzzer; do not enter later adjustment modes or change DIP/memory settings. Preserve the printed version/settings as evidence.
- Print one labelled ticket using the merchant's existing Clover UI (`MT-201`).
- If it fails, spend at most 30 minutes correcting known Clover/device configuration and repeat once.
- If the printer is not Clover-routed/supported, stop the launch attempt. Do not build an improvised direct-LAN print path onsite.

### 00:50–01:30 — Establish Clover and catalog truth

- Confirm merchant/environment, required Orders/Inventory/Print/Ecommerce grants, webhook URL/authentication and separated server tokens.
- Verify launch order type, tax, fee, every launch item/modifier and sold-out behavior.
- Run the catalog sync/mapping report; it must have zero checkout blockers.
- Repeat the secret-safe production preflight after configuration changes.

### 01:30–02:30 — Run the golden order

Use one representative order containing multiple quantities, modifiers, a drink, instruction text and accented characters:

1. Customer checks address, price and promise, then pays.
2. Confirm exactly one Clover order, one confirmed charge and one initial ticket from the configured SP700-family printer.
3. Confirm identical totals/content and the same operational number in customer status, local order, Clover, ticket and receipt.
4. The Kitchen Controller accepts and starts preparation.
5. The same controller verifies every item, records the bag as packed and ready, and places it in the physical handoff area; packing remains an audited fact rather than a separate visible work lane.
6. The system recommends the one-order run; the controller confirms the driver and departure timing, physically hands over the bag, and dispatches it. The driver verifies pickup, follows the focused stop workflow, records arrival and photo proof, and finalizes delivery.
7. Confirm customer status/notification and daily reconciliation.

This covers `MT-101/102/202/203/301` and the core staff handoffs. Any unpaid/uncertain production, duplicate charge/ticket, wrong total/order, or lost physical handoff is a hard no-go.

### 02:30–03:30 — Prove that the dangerous failures are safe

Run these targeted cases:

- Declined payment: no ticket and no production (`MT-103`).
- Duplicate submit/webhook: no duplicate charge or initial ticket (`MT-102/204`).
- Timeout or delayed/out-of-order confirmation: remains uncertain/non-cookable, then recovers once without downgrade (`MT-104/105`).
- Printer offline/reconnect: paid-unprinted alert, controlled recovery and no accidental duplicate (`MT-206`).
- Authorized reprint: visibly labelled, reasoned and audited (`MT-205`).
- Paid cancellation/refund plus duplicate retry: one correct refund, accurate customer state and reconciliation (`MT-106–109`).

Never blindly retry an ambiguous payment, print, notification or refund outcome.

### 03:30–04:00 — Prove operational controls

- Create a four-order same-zone run from test/sandbox orders; reject a fifth stop and duplicate active assignment (`MT-302/303`).
- Demonstrate route-provider outage/manual stop ordering (`MT-306`).
- Demonstrate unrelated driver and unauthorized staff access are rejected (`MT-006`).
- Exercise kill switch, alert acknowledgement and already-paid-order handling.
- Review every failure and critical alert. Four-hour confidence requires no unresolved payment, print or refund ambiguity.

### 04:00–05:00 — Assurance extension and retest

- Rehearse failed delivery, physical return to desk and reassignment (`MT-307/308`).
- Verify real Twilio delivery/callback, private tracking link and SMS-failure fallback with a consenting internal recipient.
- Rehearse internet/app/Clover/printer/SMS outage responses using the operations runbook.
- Retest any corrected configuration or narrowly scoped defect.
- If code changes onsite: add/fix a focused test, run `npm run verify`, deploy with intake disabled, then repeat the external failure. An untested hot patch is a no-go.

### 05:00–05:40 — Controlled production smoke

Only proceed with written authority, all earlier hard gates green, intake still disabled and an approved low-value amount/card/address:

- Complete one real order through charge, one ticket, preparation, packing, desk, one-order run, delivery, customer status, receipt and reconciliation.
- Execute a separately authorized refund smoke if required.
- Preserve redacted provider IDs and cent amounts; never retain card data.

### 05:40–06:00 — Confidence decision

- Review defects, critical alerts, unmatched money, printer exceptions and missing approvals.
- Confirm pilot menu/hours/zone/capacity, controller/dispatcher/driver/support, monitoring, stop thresholds and kill switch.
- The business authority records go/no-go.
- A `GO` enables only the approved limited pilot and continuous monitoring. Otherwise leave intake disabled and record the shortest follow-up.

## Hard no-go conditions

Do not enable public ordering if any of these is true:

- Release build, backup/restore, rollback, support owner, or go-live authority is missing.
- Payment success/unknown handling, idempotency, refund, or reconciliation is unproven.
- An unpaid/uncertain order can print or enter production.
- Exactly-one initial output from the configured SP700-family printer is unproven, illegible, or unrecoverable.
- A critical alert is open without a verified source resolution.
- Catalog mappings, taxes, fees, sold-outs, delivery boundary, or receipt requirements are unapproved.
- Staff/driver cannot safely execute the physical handoffs and exception flow.
- Production smoke is unauthorized or fails.

## Evidence and privacy

For every test record: test ID, environment/merchant, date/time/timezone, release commit/deployment, tester/witness, device/printer, expected/actual result, redacted evidence location, defect/retest, and approver.

Do not store secrets, card data, private tracking tokens, customer phone/address data, printer serial numbers unless operationally required, or complete provider payloads in the repository or Codex conversation.
