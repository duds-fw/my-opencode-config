---
name: code-review
description: "Review a diff in the Virtual Office independently — read the actual diff, judge it against invariants P1-P9 and the error-code contract, and report findings with severity."
---

# Review a diff independently

Produces an ordered list of findings, each with a file and line, a severity
tied to impact, and a verdict on whether the change is safe to take. Use this
when you are handed a change you did not write.

## Read the diff before the prose

Start with the change itself:

```
rtk diff
git diff
git diff --stat
```

The description of a change is a claim; the diff is the evidence. Read the
diff first, then read whatever prose came with it, and treat the prose as
unverified until the diff agrees with it. If the two disagree, the diff wins
and the disagreement itself is worth reporting.

## Priority order

Judge in this order and stop paying attention to lower bands once a higher
band is broken:

1. **Correctness** — does the change do what it claims, on the real data?
2. **Security** — trust boundaries, tokens, `state/client.json`, permissions.
3. **Data integrity** — can a record be written that contradicts another, or
   rewritten after the fact?
4. **Regressions** — what else stops working?
5. **Maintainability** — clarity, naming, duplication.

A review that lists style nits above a data-integrity hole has failed.

## Check against the invariants P1-P9

For each invariant the diff touches, ask whether it still holds. P1–P9 and the
module that enforces each are in `references/invariants.md` — read it before
judging a change that touches a guard, a transition or a done gate.

## Check the error-code contract

A refusal must carry the right code, not free text. The pipeline speaks
`project_not_registered`, `no_acceptance_criteria`, `criterion_not_falsifiable`,
`missing_deliverable`, `illegal_project_transition`, `acceptance_not_met`,
`criterion_unverified`, `self_acceptance`, `acceptor_not_authorised`. The
runtime surface adds `criterion_frozen` and `missing_deliverable_ref`. A new
refusal that invents a code, or that returns a code the caller cannot
distinguish, breaks every caller that branches on `reason`.

## Check that the guard is not inert

A guard is inert when it cannot fail. Open the record it compares and confirm:

- the field it reads actually exists on that object — a project record carries
  `id`, not `projectId`; a task carries `projectId` and `sprintId`;
- the value it compares against is the one the caller supplied;
- there is a case in which it returns false — if the comparison can never be
  true, the guard protects nothing.

The defect that cost the office a real invariant — a guard comparing
`t.projectId !== project.projectId`, always false against `undefined` — is
written out in `references/invariants.md`.

## Check that no control was silently weakened

Read the diff for removals, not only additions. Specifically:

- a permission that got wider — a role added to `ACCEPTOR_ROLES`, a check
  deleted from `validateChecklist` or `checkDoneGates`;
- a write path that now accepts a caller-supplied *conclusion* rather than raw
  input — a `met: true`, an `evidence` string, a `metBy` list, a `status`;
- a guard that moved but lost its scope — a check that used to run on every
  caller now runs only on one path;
- a `try`/`catch` that turns a refusal into a default success.

A fix that weakens a control is a **high** finding even when it makes the
failing test pass.

## Severity vocabulary

Severity tracks impact, not taste. **critical**, **high**, **medium** and
**low**, defined in `references/severity.md` — read it before assigning a
severity. Do not raise a finding for a stylistic preference unless it
violates an established convention in this repo: 2-space indent, single quotes,
semicolons, `const`/`let` never `var`, and JSDoc only where it earns its
place. A preference of yours is not a convention of the office.

## Findings format

Report each finding on its own, in priority order:

```
[severity] <file>:<line> — <one sentence: what is wrong>
  Impact: <what goes wrong, and under what conditions>
  Fix: <the smallest change that makes it correct>
```

If there are no findings, say so plainly and name what you checked.

## Outputs

- Findings ordered by severity, each with `file:line`, impact and fix.
- An explicit statement of the invariants, the error codes and the guards you
  checked, so the reader knows the coverage of the review.
- A verdict: safe to take, or blocked on the critical/high findings.

## Common mistakes

- Reviewing the commit message instead of the diff.
- Reading the whole file instead of the changed lines and their context.
- Accepting a new error string because the old test still passes.
- Missing an inert guard because it *looks* like a guard.
- Reporting nits to look thorough while a high finding goes unmentioned.
- Reviewing without running the suites the change touches — a review that
  asserts a regression exists but never ran it is a hypothesis.