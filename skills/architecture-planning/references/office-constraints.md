# Office constraints reference

Verified against `virtual-office/project-pipeline.js`, `virtual-office/agency.js`
and `virtual-office/docs/design-project-pipeline.md`.

## The six stages and who owns them

`registered → triaged → planning → delivering → acceptance → done`, with
`cancelled` reachable from any live stage. RACI per the design doc §2 —
exactly one accountable role per stage.

| Stage | Accountable | Code that owns it |
|---|---|---|
| Registration | Owner | `createProject` — name, goal, client, budget, due date |
| Triage | Product Owner | `setAcceptanceCriteria` — the typed checklist (P2) |
| Planning | Product Owner (Orchestrator does the work) | `createSprint`, `createTask` — estimates, roles |
| Delivery | Product Owner (phase-matched roles do the work) | `updateTask` (deliverable), `setTaskStatus` (→ `done` needs a deliverable, P3) |
| Acceptance — verify | Product Owner (QA does the work) | `verifyCriterion` |
| Acceptance — decide | Product Owner | `transitionProject` (→ `acceptance`) |
| Acceptance — ratify | Owner | `transitionProject` (→ `done` when the owner ratifies) |
| Done | Orchestrator | `transitionProject` (→ `done`), lessons, close |
| Cross-project timeline | Orchestrator | sequencing contending work against shared role capacity (P9) |

## The invariants P1–P9

| | Invariant | Where it is enforced |
|---|---|---|
| P1 | a project in `registered`/`triaged` has no active sprint | `checkNoActiveSprintBeforePlanning` |
| P2 | a project leaves `triaged` only with a non-empty checklist of falsifiable criteria | `validateChecklist` via `canTransition` |
| P3 | a task reaches `done` only with `deliverable.summary` set | `setTaskStatus` |
| P4 | a project reaches `done` only if every criterion is `met`, has a `metBy` task, and that task is `done` and this project's | `checkDoneGates` |
| P5 | a task's `projectId` matches its sprint's `projectId` | `createTask`, `updateTask` |
| P6 | `metrics(projectId)` is project-scoped and defaults to the active project | `metrics` |
| P7 | the role that produced the evidence may not accept it | `wouldSelfAccept` via `canTransition` |
| P8 | only `product_owner_product_manager` or `client` may accept | `isAcceptorAuthorised` via `canTransition` |
| P9 | the Orchestrator owns the cross-project timeline | design doc §2, §6 — not a code guard |

### The two that catch people out

**P4** compares `task.projectId` against `project.id`, so a guard reading
`project.projectId` compares against `undefined` and lets another project's
task satisfy the gate. **P7/P8**: the role that produced the evidence may not
accept it, and only `product_owner_product_manager` or `client` may accept at
all.

`PROJECT_TRANSITIONS` in `project-pipeline.js` is the legal edge list; nothing
leaves `done`, and `cancelled` is reachable from every live stage.

## The escalation policy, in full

`DECISION_POLICY` in `agency.js` (exported, and readable via
`GET /api/agency/decisions` under `policy`):

**strategic** — the owner's call:
- Changing the goal, scope, or acceptance criteria of a project
- Adding, removing, or re-prioritising work in a sprint
- Spending beyond budget, or moving budget between projects
- Accepting a known defect or risk to hit a date
- Choosing between approaches with different business outcomes
- Anything that changes what the client receives, when, or at what cost

**execution** — the office's own call:
- Implementation approach, library choice, internal architecture
- Task breakdown, which subagent, and ordering within a sprint
- Fixing a bug, writing tests, refactoring, adding instrumentation
- Retrying a failed operation or restarting a service
- Any reversible change inside the sprint's committed scope

## Authority order

`AGENTS.md`: `agency.js` is the mechanism, `docs/agency-decisions.md` is the
authority, the SOP is the procedure, the role guidelines are role detail. A
conflict escalates at L2 (Orchestrator); a conflict that would change an owner
decision escalates to the owner.

The SOP (`docs/sop-virtual-office.md`) and the role guidelines
(`docs/role-guidelines.md`) are **drafts awaiting the owner's review** — they
do not override `AGENTS.md`, `docs/agency-decisions.md` or the code.

## Pipeline suites

`node tools/project_pipeline_test.js` — the stage machine, P2, P3, P4, P7, P8, P6,
and the migration from the pre-pipeline model.

`node tools/agency_rules_test.js` — the agency rules.
`node tools/agency_transition_test.js` — task and project transitions.
`node tools/read_path_purity_test.js` — a read must never write (F-17).

Deriving the cases themselves is the **testing-strategy** skill's job.
