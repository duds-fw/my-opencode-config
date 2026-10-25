# The invariants P1–P9

For each invariant a diff touches, ask whether it still holds.

| | Invariant | Where it is enforced |
|---|---|---|
| P1 | a project in `registered`/`triaged` has no active sprint | `checkNoActiveSprintBeforePlanning` |
| P2 | a project leaves `triaged` only with a non-empty checklist whose every criterion has falsifiable text | `validateChecklist` via `canTransition` |
| P3 | a task reaches `done` only with `deliverable.summary` set | `setTaskStatus` |
| P4 | a project reaches `done` only if every criterion is `met === true`, has a `metBy` task, and every referenced task is `done` | `checkDoneGates` |
| P5 | every task's `projectId` matches its sprint's `projectId` | `createTask`, `updateTask` |
| P6 | `agency.metrics()` is project-scoped via an optional `projectId` | `metrics` |
| P7 | the accepting role differs from every role that produced a `metBy` task | `wouldSelfAccept` via `canTransition` |
| P8 | only `product_owner_product_manager` or `client` may accept | `isAcceptorAuthorised` via `canTransition` |
| P9 | the Orchestrator owns the cross-project delivery timeline | design doc §2, §6 — not a code guard |

## The defect that cost the office a real invariant

A guard comparing `t.projectId !== project.projectId` was always false against
`undefined`, so a project reached `done` on another project's evidence while
the guard read as protection. The working form is
`t.projectId !== project.id` in `checkDoneGates`.

`checkDoneGates` also checks that every criterion referenced by a `metBy` task
belongs to *this* project, and that the task is `done`.

## Other codes in the same area

`ACCEPTOR_ROLES` is `['product_owner_product_manager', 'client']`
(`project-pipeline.js:58`). `client` is not a `ROSTER` matrixRole
(`agency.js:85`), so a role check that resolves against `ROSTER` silently
excludes the owner — a review must flag a guard that does that.
