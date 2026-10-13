# Milestone Execution Plan Template

Copy this template into `docs/launch/plans/milestone-XX-<name>.md` before implementing a launch milestone. Keep it current while work proceeds; it is an execution record, not a speculative essay.

## Milestone

- Number and name:
- Status: `NOT_STARTED | IN_PROGRESS | BLOCKED | CODE_COMPLETE | MANUAL_VERIFICATION_REQUIRED | VERIFIED`
- Branch:
- Owner:
- Started:
- Last updated:

## Goal

Describe the observable outcome this milestone must produce.

## Current behavior

Document the current execution path with file and symbol references. Distinguish implemented behavior from verified behavior.

## Required behavior

Describe the target behavior and the invariants it must preserve.

## Scope

### In scope

-

### Out of scope

-

## Dependencies

- Prior milestones:
- External services or credentials:
- Business decisions:
- Manual/hardware gates:

## Assumptions

List reversible assumptions. Add material assumptions to `docs/launch/DECISIONS.md`.

## Expected change surface

### Files and modules

-

### Database changes

- New models/fields/enums/indexes:
- Migration/backfill strategy:
- Compatibility and rollback:

### API changes

- Routes/contracts:
- Authorization:
- Idempotency/concurrency:
- External provider behavior:

### UI changes

- Customer:
- Order controller/packer:
- Dispatcher:
- Driver:
- Manager/reporting:

## Security and privacy

- Authentication/authorization:
- Sensitive data:
- Abuse cases:
- Audit events:
- Secret/configuration changes:

## Failure cases and recovery

| Failure | Detection | User/staff impact | Recovery | Automated test |
|---|---|---|---|---|
|  |  |  |  |  |

## Implementation sequence

1.

## Automated verification

- Unit tests:
- Integration tests:
- Contract tests:
- Browser tests:
- Failure injection:
- Type/lint/build commands:

Record commands, exit codes, and important output when executed.

## Manual verification

| Test | Environment | Preconditions | Expected result | Evidence | Status |
|---|---|---|---|---|---|
|  |  |  |  |  | NOT_RUN |

Never mark a manual test passed without evidence from the named environment.

## Acceptance criteria

- [ ] Scoped deliverables implemented.
- [ ] Applicable criteria in `docs/launch/ACCEPTANCE_CRITERIA.md` satisfied.
- [ ] Automated checks pass.
- [ ] Authorization and audit behavior verified.
- [ ] Failure states are visible and recoverable.
- [ ] Documentation and status ledger updated.
- [ ] Diff reviewed for correctness, security, concurrency, and missing tests.
- [ ] Remaining external/manual gates explicitly recorded.

## Rollback and deployment considerations

- Feature flags:
- Backward compatibility:
- Data rollback limitations:
- Operational rollback:

## Progress log

| Date | Change | Verification | Decision/blocker |
|---|---|---|---|
|  |  |  |  |

## Final handoff

- Files changed:
- Migrations:
- Tests added:
- Commands run:
- Review findings and resolutions:
- Remaining manual verification:
- Known risks:
- Recommended next milestone/action:
