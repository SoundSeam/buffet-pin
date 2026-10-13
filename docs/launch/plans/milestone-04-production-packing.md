# Milestone 04 — Production and packing workflow

- Status: `MANUAL_VERIFICATION_REQUIRED`; repository workflow/API/UI is code-complete and staff/device rehearsal remains external.
- Goal: give the order controller and packer explicit paid/printed acceptance, preparation, item verification, packed, and dispatch-desk actions with actor/timestamp audit.
- Scope: additive packing-check persistence, CAS transition services, authorized APIs, production-board UI, cancellation/print exception visibility, automated normal/invalid/stale tests.
- Invariants: unpaid or unconfirmed-print orders cannot start production; packing and desk placement are separate; stale actions fail; cancellation remains visible and paid cancellation enters M8 refund coordination.
- Acceptance: AC-401–404 and TR-004/TR-009/TR-014/TR-015 repository layers. Staff device/speed and physical bag/ticket rehearsal remain manual.

## Progress

| Date | Change | Evidence |
|---|---|---|
| 2026-07-22 | Plan created after M3 repository implementation. | Change surface and acceptance rows reviewed. |
| 2026-07-22 | Added paid/printed CAS transitions, complete packing verification, separate desk placement, actor audit, database concurrency tests, and production board. | Typecheck/lint/unit/database aggregate verification recorded in implementation status. |
| 2026-07-22 | Added paid cancellation/rejection warning panel, blocked terminal bypass through production/legacy routes, and projected customer facts only from operational transitions. | Aggregate `npm run verify` passed; staff/device rehearsal remains EG-012. |
