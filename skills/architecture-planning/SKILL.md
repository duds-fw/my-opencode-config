---
name: architecture-planning
description: "Turn an owner request into an implementation plan for the Virtual Office: where the change sits in the six-stage pipeline, the files to touch, and the invariants it must hold."
---

# Plan a change against the office's existing design

Produce a plan an engineer can execute without asking a follow-up question: the
files, the behaviour change, the invariants preserved, the criteria it must
satisfy, and the suites that prove it.

## 1. Read the implementation before proposing anything

Never plan against a description — plan against the code.

1. `grep -n` the symbol you intend to change and read that range.
2. Read the **guard** it sits inside. The office's real defects were guards
   that compared the wrong field (`project.projectId` when the record carries
   `id`) or were never reached.
3. Read the **actual** field names of the objects you will touch: a project is
   `project.id`, a task is `task.projectId`, a criterion is
   `{id, text, met, metBy[], evidence]`.
4. Read the callers — `server.js` routes, `agency.js` exports, `tools/` suites.

Use the **codebase-exploration** skill for the search mechanics.

## 2. Place the change in the pipeline

Name the stage the request lands in and the stage it may reach. Most requests
never leave their stage — say so. The stage list, the stage→owner→code table
(RACI per `docs/design-project-pipeline.md` §2) and the legal edge list are in
`references/office-constraints.md`.

## 3. Name the invariants the change must not break

P1–P9, the module that enforces each, and the two that catch people out are
listed in `references/office-constraints.md`. The rules live in
`project-pipeline.js`; `agency.js` owns the state. Put a new rule in the module
that owns it — a rule in the wrong file is a rule nobody tests.

## 4. Name dependencies, constraints and risks

- **Stack:** Node.js, CommonJS `require`, zero runtime dependencies, no build
  step, no framework, no `npm install`. `node tools/<suite>.js` runs the suites.
- **State:** JSON under `state/`, owned by the running server, gitignored.
  Never commit it; never read it while the server runs — the API is the truth.
- **Service:** `virtual-office.service`; restart with
  `systemctl restart virtual-office.service`. Never `opencode service restart`
  from inside a session hosted by that server.
- **Read path:** a GET must not write (F-17, `tools/read_path_purity_test.js`).
- **Budget:** `project.budgetHours` is a ceiling. An overrun is a report item in
  the owner's digest, not a licence to spend.
- **Capacity:** roles are shared across concurrent projects; sequencing is the
  Orchestrator's call (P9).
- **Forgery:** every write that accepts a caller-supplied *conclusion* is a
  forgery path. Accept raw input; derive the verdict.

## 5. Write the plan

One line per item:

- **Files to touch** — `path` + the symbol + why that file
- **Behaviour change** — before → after, in one sentence
- **Invariants** — which of P1–P9 this touches, and how each still holds
- **Acceptance criteria** — falsifiable, one sentence each, naming a subject and
  a threshold (see the **requirements-analysis** skill)
- **Suites to run** — `node tools/<suite>.js` and what a pass looks like
- **Risk and rollback** — what breaks, and how to undo it

Order the items so each one leaves the tree working. If the plan needs a
migration, say what it does to records it cannot recognise — never silently
downgrade an unrecognised value. `migrateProject` downgrades to `registered`
and reports a note; a silent downgrade was a real defect.

## 6. Do not rewrite what already works

- Extend the existing rule in `project-pipeline.js` instead of adding a second
  place that decides the same thing.
- Additive only: new fields, new routes, new checks. Do not change what an
  existing field means.
- No speculative configuration, no single-implementation interfaces, no
  abstraction for one caller.
- If the existing code already does the required behaviour, the plan is
  "no change" — say that.

## 7. Decide what escalates

`agency.js` exports `DECISION_POLICY`, the office's own escalation rule.

**The owner's call (strategic)** — goal, scope, acceptance criteria, sprint
priorities, budget, accepted risk, different business outcomes, what the client
receives. **The office's call (execution)** — implementation approach, task
breakdown and ordering, fixes, tests, refactoring, retries, service restarts,
reversible changes inside the committed scope. Full policy, verbatim from the
code: `references/office-constraints.md`.

Raise a strategic decision with `POST /api/client/decision` (`question`,
`context`, `options`, `projectId`, `requestedBy`, `severity`) and carry on with
the parts that are not blocked. A missing engineering judgement is yours to
make — decide it, record the reasoning, and do not spend the owner's attention
on it.

## Outputs

- The stage the request lands in, and the stage it may reach
- The files and symbols to change, with the behaviour change per file
- The invariants touched and how each still holds
- Falsifiable acceptance criteria
- The suites to run and what a pass looks like
- Escalations raised (with the `dec_` id) — or "none, this is execution-level"

## Common mistakes

- Planning against a doc instead of the code
- Proposing a new module when `project-pipeline.js` already owns the rule
- Naming invariants without checking the guard reads the right field
- Writing acceptance criteria that no pipeline gate can check
- Escalating an implementation choice and stalling the work
