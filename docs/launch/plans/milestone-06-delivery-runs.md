# Milestone 06 — Delivery zones, runs, and driver manifests

- Status: `MANUAL_VERIFICATION_REQUIRED`; run/manifest lifecycle is code-complete, real boundaries/drivers/field rehearsal remain external.
- Goal: controlled one-to-four-stop same-zone runs with desk-ready bags, eligible/on-shift driver, stable stop order, verification, pickup, delivery, reassignment/cancellation history, and driver-scoped manifests.
- Scope: shift persistence, run operation service/APIs, driver manifest, CAS/audit tests, polygon delivery eligibility, and the manager delivery-zone map. Final owner pricing approval, roster policy, proof-of-delivery policy, and road rehearsal remain external.
- Acceptance: AC-601–605, TR-009/TR-016/TR-017 repository layers.

## Change surface, failure and rollback

- Additive shift/eligibility/run/stop schema; run operation service; dispatcher and driver APIs/UIs; revocable versioned driver sessions.
- Additive polygon fields preserve existing circular zones. Polygon matching is server-side, treats an edge as inside, fails closed on malformed GeoJSON, and takes precedence over the legacy global radius when configured.
- The manager-only `/admin/delivery-zones` page previews four Châteauguay road-corridor polygons and installs them only while online ordering is off. Installation disables rather than deletes old active zones and creates an immutable audit event.
- Orders must be paid and `AT_DISPATCH_DESK`; runs contain 1–4 distinct orders; active run or legacy direct assignment blocks collision; pickup rechecks shift/zone eligibility.
- Failed stops cannot requeue until the dispatcher physically confirms the returned bag at the desk. All reassignment/cancel/exception facts remain audited.

## Verification and review

- Database tests cover max capacity, uniqueness, stable positions, wrong driver, off-shift pickup, cross-zone rejection/override audit, legacy collision, failure, return-to-desk and requeue.
- Unit tests cover representative addresses in all four corridors, exclusions beyond the launch area, boundaries, malformed polygons, and holes. Prisma validation, TypeScript, lint and safe production build pass.
- Review disabled legacy direct-assignment/per-order driver mutations and redirects drivers to run manifests.

## Progress and handoff

Repository behavior is code-complete. The proposed four-zone map is based on the Saint-Jean-Baptiste/Route 138, Route 132/Maple Grove/Léry, central river, and Mercier corridors; Montréal and the Mercier Bridge corridor are excluded. Owner sign-off on the map/economics plus one dinner-period outer-edge drive per zone remain EG-013, while roster/safety/proof-of-delivery policy remains EG-014–015.
