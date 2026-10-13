# Milestone 07 — Assisted batching and routing

- Status: `MANUAL_VERIFICATION_REQUIRED`; deterministic batching/provider fallback is code-complete, routing account/field tuning remain external.
- Goal: deterministic, explainable same-zone suggestions with hard constraints before optimization, configurable capacity/wait/deadline/low-demand release, dispatcher approval, and manual fallback.
- Scope: pure suggestion engine using the M0 routing contract/fake, config fields, dispatcher API, fixed-matrix/failure tests. No autonomous dispatch or live GPS.
- External gates: routing credentials/terms, real route comparison, and dispatcher threshold approval.
- Acceptance: AC-701–704 and TR-018–020 repository layers.

## Change surface, failure and rollback

- Deterministic batching pure function, Google Routes adapter, dispatcher suggestions/approval UI, persisted route explanation/estimate and configurable release thresholds.
- Hard constraints run before optimization. 408/429/5xx and transient matrix statuses use manual fallback; incomplete matrices are unknown; no-route is terminal for that pair. Provider outage never relaxes zone, desk, eligibility or max-four rules.
- Suggestions carry short-lived server-signed evidence bound to the exact driver and ordered stops. Stale/forged browser estimates are rejected; suggestions can be ignored and manual order retained without schema rollback; autonomous/AI dispatch is deferred.

## Verification and review

- Unit tests cover capacity, oldest-wait, deadline-risk, low-demand, no-trigger hold, same-zone separation, deterministic ordering, matrix duplicates/index/completeness, transient failures, and manual fallback.
- Database tests cover reasoned cross-zone override and persisted route explanation/impact. Unit/browser tests prove route-evidence binding, authenticated dispatcher fallback approval, and server authorization.

## Progress and handoff

Repository behavior is code-complete; real account/quota/data use, route comparison, wording/buffer and threshold approval remain EG-016/017/026.
