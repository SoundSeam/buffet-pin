# Release Evidence Checklist

This is the required human verification order. Do not skip ahead to a real payment or public enablement. Every record must include environment, date/time/timezone, build/commit, tester, preconditions, exact result, redacted evidence location, defects/retest, and approving owner.

If restaurant access is limited to one day, complete Phases 1–3 and all remote portions first, then execute `TOMORROW_ONSITE_CHECKLIST.md`. `ONE_DAY_ONSITE_LAUNCH_PLAN.md` remains the detailed evidence plan. The condensed schedule changes timing, not acceptance criteria.

## Phase 1 — Release candidate and ownership

1. Run `npm ci`, `npm run verify`, and `npm run security:audit` on the exact release candidate.
2. Record the pre-existing dirty-worktree boundary and review only intended launch files; create an approved release commit outside this task.
3. Name restaurant and technical primary/backup support for every pilot window; verify their least-privilege access.
4. Approve retention, privacy, cancellation/refund, food-safety/allergy, proof-of-delivery, driver, and support policies.

## Phase 2 — Hosting, secrets, and recovery

5. Provision the production domain/HTTPS, database, monitoring, scheduled operational scan, and redacted log/error destinations.
6. Validate all production secrets and distinct credentials. Confirm fake providers, failure injection, test bypass, sandbox Clover, test currency, and API-base overrides are rejected.
   Run `npm run launch:preflight:production` without printing or attaching secret values.
7. Deploy with `onlineOrderingEnabled=false`, `deliveryEnabled=false`, and an approved `maxActiveOrders` pilot cap.
8. Exercise `/api/health`, `/api/readiness`, critical alert delivery, acknowledgement, escalation, and the independent kill switch.
   Run `npm run launch:preflight:production:probe`; it must confirm intake remains paused.
9. Take a provider backup and complete a timed isolated restore; reconcile row counts and immutable intents/audits. Record RPO/RTO and owner approval.

## Phase 3 — Clover catalog and payment sandbox

10. Confirm merchant token model and least-privilege Orders/Inventory/Print grants in Clover sandbox.
11. Verify delivery order type, service charge, taxes, items, modifier groups/options, sold-outs, and zero-blocker mapping report.
12. Run sandbox success, decline, duplicate submit/callback, delayed/out-of-order callback, timeout/unknown/recovery, full refund, and reconciliation cases. Retain only sanitized provider IDs/payload evidence.

## Phase 4 — Exact printer and restaurant stations

13. Record the exact SP700-family submodel/suffix/interface/configuration/firmware/emulation, Clover device, default firing device, printer association, paper, and ribbon.
14. Print a clearly labelled Clover test ticket. If a sandbox merchant device is actually associated with the onsite SP700, run an API-created paid sandbox order through it. Otherwise, keep sandbox and production credentials separated and reserve the exact app-to-live-SP700 proof for the explicitly authorized low-value production smoke. Confirm one initial ticket contains the immutable order number, every item/modifier/note, and is legible.
15. Run printer offline, queued reconnect, ambiguous event, controlled browser/paper fallback, explicit reprint with reason, duplicate prevention, and paid-unprinted alert drills.
16. Rehearse order-controller, preparation, packing checklist, separate packed/desk placement, cancellation/refund warning, and bag number read-back on representative devices.

## Phase 5 — Dispatch, drivers, routing, and communication

17. Approve delivery zones, driver eligibility/shift policy, proof/failed-delivery policy, routing data use/quota, and initial release thresholds.
18. Rehearse one-, two-, and four-order same-zone runs; bag verification, reassignment, cancellation-before-pickup, departure, ordered stops, delivered, failed stop, and recovery.
19. Compare deterministic route suggestions with known routes; simulate routing outage and complete manual map/stop-order fallback without blocking dispatch.
20. Approve customer SMS consent/templates and send real normal/refund/failure tests. Verify the private tracking URL, customer-safe status, and notification failure alert.

## Phase 6 — Receipt, close, accessibility, and incident rehearsal

21. Obtain qualified Québec legal/accounting approval of configured business/tax receipt fields and refund presentation.
22. Complete an end-of-day sandbox report matching operational order number, Clover order/payment/refund IDs, items, tax, fee, tip, total, and all unmatched/unknown exceptions.
23. Test customer, operator, dispatcher, and driver flows on approved mobile/station devices, including accessibility and dinner-condition usability.
24. Conduct the full internet, Clover, app, printer, routing, notification, driver, refund, privacy/security, and support outage tabletop; attach signed results.

## Phase 7 — Controlled production authorization

25. Hold the formal go/no-go review. Every open gap is closed, explicitly deferred outside launch scope, or waived with owner/rationale/expiry/compensating control. Critical unknowns cannot be waived silently.
26. Obtain explicit authorization for a low-value production smoke; keep public ordering disabled.
27. Execute one production order through payment, exactly one physical print, controller acceptance, preparation, packing, desk, approved run, driver completion, digital receipt, and reconciliation.
28. Execute a separately authorized refund smoke if refunding the delivered smoke would invalidate the end-to-end evidence.
29. Confirm kill switch, rollback, support roster, pilot cap/radius/menu/hours, expansion/stop thresholds, and monitoring are live.
30. Only the named go-live authority may enable delivery and online ordering. Record timestamp/build/approver; monitor the first service window and stop on any documented threshold.

## Actions expressly not performed by Codex

No push, pull request, deployment, production setting/data change, real charge/refund, credential rotation, Clover merchant mutation, printer action, public enablement, or production smoke was performed.
