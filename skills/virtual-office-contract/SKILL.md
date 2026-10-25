---
name: virtual-office-contract
description: "The Virtual Office's binding rules: the six-stage pipeline, invariants P1-P9, the error codes, the role map and the version-control rules. Load before changing office code."
---

# The Virtual Office Contract

These are the office's binding rules, not style. Breaking one produces a
defect the office has already made once. **The code wins**: `agency.js` is
the mechanism, `docs/agency-decisions.md` the authority,
`docs/sop-virtual-office.md` the procedure, `docs/role-guidelines.md` role
detail. Where they conflict, escalate — do not pick one silently.

## The pipeline

Six stages: **Registration → Triage → Planning → Delivery → Acceptance → Done**.

Stored statuses (`PROJECT_STATUSES` in `project-pipeline.js`): `registered`,
`triaged`, `planning`, `delivering`, `acceptance`, `done`, `cancelled`.
`active` is a **derived alias, never stored** — `planning` and `delivering`
are the active statuses. `acceptance → planning` is the rework path; any
other move is `illegal_project_transition`.

The legal transitions and who owns each stage are in
`references/stage-ownership.md` — read it before you move a project or route
a stage.

## The invariants

- **P1** — a project in `registered`/`triaged` has no active sprint.
- **P2** — a project leaves `triaged` only if `acceptanceCriteria.length > 0`
  and every criterion has non-empty *falsifiable* text.
- **P3** — a task reaches `done` only if `deliverable.summary` is set.
- **P4** — a project reaches `done` only if every criterion has `met === true`,
  has at least one `metBy` task, and every referenced task is `done`.
- **P5** — every task's `projectId` matches its sprint's `projectId`.
- **P6** — `metrics()` is project-scoped; it takes an optional `projectId` and
  defaults to the active project.
- **P7** — the role that performed a delivery may not accept that delivery;
  the accepting role must differ from every role that produced a `metBy` task.
- **P8** — only `product_owner_product_manager` or `client` may accept a
  project.
- **P9** — the Orchestrator owns the cross-project delivery timeline.

## The error codes

`project_not_registered`, `no_acceptance_criteria`, `criterion_not_falsifiable`,
`missing_deliverable`, `illegal_project_transition`, `acceptance_not_met`,
`criterion_unverified`, `self_acceptance`, `acceptor_not_authorised`.

Two more exist in the code and are not in the design doc's list — read
`project-pipeline.js` for the current set: `criterion_frozen`,
`missing_deliverable_ref`.

Refuse with these codes. Never with free text.

## The defects these rules exist to prevent

Six real defects this office shipped. Each is a rule above, inverted: an
inert guard, a forged acceptance, a re-verified acceptance, a rewritten
deliverable, a bogus commit SHA, a silent migration.
`references/known-defects.md` gives the mechanism of each — read it before
writing a guard, a migration or an acceptance path.

## The API is the source of truth

The server holds state in memory and rewrites it. **Do not read or edit the
JSON files under `state/` while the server is running** — your edit will be
overwritten. Go through the API. The route list is in
`references/api-surface.md`.

`server.js` currently registers **no** project-stage route beyond
`POST /api/agency/project`. The stage endpoints in
`docs/design-project-pipeline.md` §5 are **specified but not wired**. Do not
assume the pipeline is reachable over HTTP, and do not assert it in a report
or a document.

## State, roles and ownership

- `state/` is **gitignored**. The server owns it in memory.
- `state/client.json` holds the owner bot token (mode 0600). Never log it,
  echo it into a report or a prompt, or commit it.
- Tasks and sprints live inside `state/agency.json` (written by `agency.js`).
  `server.js` additionally maintains `state/projects.json`, `state/runs.json`,
  `state/usage.json`, `state/autopilot_session.json`. There are currently
  **two sources of truth for projects** — treat that as a known defect, not a
  pattern to extend.
- The 17-role `ROSTER` in `agency.js` maps each `matrixRole` to the OpenCode
  subagent that does the work. Capacity is per role, per sprint, and shared
  across concurrent projects — roles are the scarce resource.
- `ACCEPTOR_ROLES = ['product_owner_product_manager', 'client']`. `client` is
  **not** a roster matrixRole, so `actingRole` must never be read from a
  request body. Compute the acting role from server-side state.

## Version control (standing rule)

- **Commit every code change locally before the task leaves `in_progress`.**
  Committing is inside your authority — do it without asking.
- A deliverable of kind `code` must carry the commit SHA in `deliverable.ref`.
- **Never push, open a PR, tag, or write to a remote** without the owner's
  explicit go-ahead. A local commit is not a push.
- **Never commit `state/`.**
- If you find yourself editing a file that is not under version control,
  that is the more urgent problem. Fix the version control first.

## Authority

Own decisions are execution-level; the owner's are strategic. Escalate
scope, budget, risk and prioritisation to the owner. Implementation choices
are yours.

**A missing engineering judgment is yours to make.** The escape hatch is for
genuine strategic forks — different business outcomes — not for a decision
with a defensible answer. Decide, record the reasoning, carry it.

Do not exceed the project budget. If the work genuinely needs more hours,
raise a report item in the owner's digest with the overrun, the reason and
the options. Do not spend the hours.

Never describe the office, its work, or a role's output as "ISO compliant",
"certified", or "audit-ready". The office is not certified to any standard.
