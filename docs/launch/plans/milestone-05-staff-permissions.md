# Milestone 05 — Staff roles and permissions

- Status: `MANUAL_VERIFICATION_REQUIRED`; capability enforcement and provisioning are code-complete, named production accounts/revocation rehearsal remain external.
- Goal: named, active, revocable manager/operator/dispatcher/reporting identities with server-side capability checks and immutable access audit.
- Scope: policy matrix, Supabase-user-to-staff resolution, manager-only staff lifecycle, operational route capability enforcement, provisioning script, authorization tests.
- Safety: no staff row means no privileged access; UI hiding is not authorization; manager controls refunds/catalog/settings/staff, operator controls production/printing, dispatcher controls runs/drivers, reporting is read-only.
- External gate: manager supplies and approves named roster/role assignments; driver legal/employment policy remains external.
- Acceptance: AC-501–503 and AC-G07 repository layer.

## Change surface, failure and rollback

- `lib/staff-policy.ts`, Supabase staff resolution, staff lifecycle routes, and every delivery menu/settings/production/print/dispatch/refund/reporting mutation route.
- No active staff row or missing capability fails closed on the server. Menu/settings mutations create immutable actor audit evidence; UI visibility is never the authorization boundary.
- Provisioning is additive and production accounts are not created automatically. Revocation is reversible by an authorized manager; audit rows remain immutable.

## Verification and review

- Role-matrix unit tests prove manager-only financial/catalog/settings/staff authority and operator/dispatcher/reporting separation.
- Real browser requests prove unauthenticated denial plus authenticated manager/operator/dispatcher/reporting positive and negative boundaries; production build/type/lint pass.
- Review replaced allow-list-only delivery menu/settings checks with `CATALOG_WRITE`/`SETTINGS_WRITE` and coupled catalog, mapping, driver and access-link mutations to immutable actor audit in the same transaction. Named production roster and shared-device/revocation rehearsal remain EG-011.

## Progress and handoff

Repository enforcement is code-complete and the milestone is `MANUAL_VERIFICATION_REQUIRED`. No production staff account was created, revoked, or tested.
