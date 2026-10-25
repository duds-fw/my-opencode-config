---
name: error-handling
description: "Validate raw input at trust boundaries and refuse with the office's stable error codes, never with free text or a caller-supplied verdict."
---

# Validate at the boundary, refuse with a code

Produces validated data flowing inward and machine-readable refusals flowing
outward. Use whenever a write path accepts caller input, or a guard decides
whether something is allowed.

## The boundary rule

Validate raw input at the edge; pass validated data inward. The edge is the
function that receives untrusted data. `agency.js` `updateTask` validates
estimate, project, sprint, phase, role and deliverable **before** it
mutates anything, so a rejected patch leaves the task untouched.

- A write path must never accept a caller-supplied **conclusion**. The
  caller may supply raw input — a checklist, a claim of evidence, a task id
  — never the verdict the office is supposed to reach.
- Every guard must be checked against the **real field names** of the object
  it guards. A project record carries `id`; a task carries `projectId`.
  Comparing `project.projectId` with a task's `projectId` compares
  `undefined` and passes: that guard was inert, and a project reached `done`
  on another project's work. The working form is in `project-pipeline.js`
  `checkDoneGates`.

## The forgery defect, before and after

`setAcceptanceCriteria` once wrote the caller's verdict into the stored
checklist — `met`, `metBy` and `evidence` straight from the caller. Now
`project-pipeline.js` `normaliseCriterion` builds the stored shape and forces
every verdict field to "not yet decided". `agency.js` `setAcceptanceCriteria`
maps `pipeline.normaliseCriterion` over the caller's array, validates it with
`pipeline.validateChecklist`, and only then stores it. Every new write path
follows the same shape: **normalise (force the verdict fields) → validate the
raw input → store**. The before/after code is in
`references/forgery-defect.md`.

## Only an authorised verification step sets `met`

- `agency.js` `verifyCriterion(projectId, criterionId, met, evidence, opts)`
  is the only path that sets `met: true`. It refuses without evidence
  (`criterion_unverified`), with evidence longer than 2000 characters, and
  with a `metBy` task that is not one of this project's own tasks.
- A criterion is **frozen** once verified: `verifyCriterion` refuses with
  `criterion_frozen` when the project is in `acceptance` or `done`, and
  refuses to re-point a `met` criterion at different evidence. Un-verifying
  (marking it unmet again) stays allowed before acceptance — the honest move
  when the evidence turns out to be wrong.
- `agency.js` `transitionProject` clears `met` and `evidence` when a project
  moves back from `acceptance` to `planning` (the "request changes" path).

## The codes the pipeline speaks

Raise these, never free text.

| code | raised by |
|---|---|
| `project_not_registered` | `agency.js` `transitionProject`, `setAcceptanceCriteria`, `verifyCriterion` — unknown project id |
| `no_acceptance_criteria` | `project-pipeline.js` `validateChecklist`, `checkDoneGates` — empty checklist |
| `criterion_not_falsifiable` | `project-pipeline.js` `validateChecklist` — a criterion whose text is a goal, not a checkable claim |
| `missing_deliverable` | `agency.js` `setTaskStatus` — a task reaching `done` with no deliverable summary |
| `illegal_project_transition` | `project-pipeline.js` `canTransition`, `checkNoActiveSprintBeforePlanning` |
| `acceptance_not_met` | `project-pipeline.js` `checkDoneGates` — a criterion unmet, unbacked, or citing a task that is not `done` |
| `criterion_unverified` | `agency.js` `verifyCriterion` — unknown criterion, missing or oversized evidence, foreign `metBy` task |
| `self_acceptance` | `project-pipeline.js` `canTransition` — the accepting role produced the evidence (P7) |
| `acceptor_not_authorised` | `project-pipeline.js` `canTransition` — a role outside `ACCEPTOR_ROLES` accepted (P8) |

Also in force: `criterion_frozen`, `missing_deliverable_ref` (`agency.js`
`verifyCriterion`, `updateTask`) and the task-level codes `invalid_status`,
`invalid_estimate_hours`, `unknown_project`, `project_mismatch`,
`unknown_sprint`, `sprint_project_mismatch`, `invalid_role`,
`role_not_eligible`, `invalid_deliverable`, `gate_pending`,
`role_not_approver`, `insufficient_capacity`, `ineligible_agent`,
`task_not_found`, `task_in_progress`.

## What the office returns

- Domain functions: `{ ok: false, reason: '<code>', errors?: [string] }`.
  `errors` says *why* in a sentence; `reason` is the code to branch on.
  Return the offending record when the caller needs it.
- `/api/agency/*` handlers answer `200` on `ok`, `409` on a refused
  mutation, `404` when the record is not found, `400` when the body is not
  JSON, with the `{ ok: false, reason }` object as the body.
- `POST /api/agency/escalation/:id/resolve` uses the other envelope,
  `{ ok: false, error: { code, message } }`, with the status taken from
  `ESCALATION_RESOLVE_STATUS` in `server.js`. Match the envelope of the
  route you are editing, not the other one.
- An unexpected exception in a handler is answered `400` with
  `{ ok: false, error: '<message>' }`. Do not let a throw escape the handler:
  `docs/agency-security-review.md` records F-09, an unguarded decode inside
  the async handler, as a live finding.

## Outputs

The validated inward path, the coded refusals outward, and the suite lines
proving the refused cases left state untouched.

## Common mistakes

- Validating only in the route handler and letting the domain function
  trust the result.
- Storing the caller's `met` / `evidence` because "QA already checked it".
- A guard comparing `project.projectId` — the field is `project.id`.
- A refusal that returns a sentence instead of a code.
- Half-applying a change: validate everything first, mutate afterwards.
- Copying two open gaps: `updateTask` accepts any non-empty `ref` for a
  `code` deliverable, and lets a `done` task's deliverable be rewritten.
