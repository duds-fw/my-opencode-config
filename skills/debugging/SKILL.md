---
name: debugging
description: "Find the root cause of a defect in the office's Node code without guessing — reproduce, isolate, separate finding from hypothesis, and verify the fix against the original failure."
---

# Find the root cause, not the symptom

Produces a diagnosis a reader can act on: the mechanism that broke, the
evidence that proves it, and the fix verified against the original failure.
Use this when something misbehaves and the cause is not yet known.

## Step 1 — reproduce, or capture the strongest evidence you have

Reproduce the failure whenever it is economical. In this office that usually
means a `tools/` script against an isolated `AGENCY_STATE_DIR`: drive the same
calls and watch the verdict come back wrong. A reproduction that fails the
same way twice is worth more than any amount of reading.

When reproduction is not economical — the failure needs live office state, a
browser, or a provider — capture the strongest available evidence instead:
the exact request body and the exact response, the state record as it stood,
the error with its stack. Say plainly which of the two you have.

## Step 2 — isolate the mechanism

Read the trace back to the branch that produced the wrong value, not to the
line that reported it. A refusal reported at `server.js` is decided three
functions earlier in `agency.js` or `project-pipeline.js`.

Reduce the problem until the failure is explained by one branch. Ask: what
value would have to be true for this code path to produce this output? Then
check that value against the real data, not against your assumption of it.

## Step 3 — separate finding from hypothesis

A **confirmed finding** names a mechanism, cites the code path, and shows the
evidence that demonstrates it. A **hypothesis** names a suspected mechanism and
says what evidence would settle it. Write them apart, in the report, and never
let a hypothesis drift into the finding section because it sounds plausible.

- Confirmed: "`project-pipeline.js:219` compares `t.projectId` against
  `project.id`; the task's `projectId` is `proj_other`, so the guard fires and
  `checkDoneGates` returns `acceptance_not_met`."
- Hypothesis: "the cross-project guard may not compare the right field — it
  needs a test where a foreign task is cited, to confirm it fires."

If a check could not be run, the report says which check was skipped and why.
That is a legitimate outcome; a fabricated result is not.

## Step 4 — read the first frame you own

In a stack trace, the last frame is where the error surfaced; the first frame
you own is where it started. Skip library frames, skip the HTTP layer, and
land on the first frame in office code. The frames between it and the surface
are propagation, not cause. In the same spirit, read the guard's own source
before theorising about it — a guard is a few lines, and the answer is usually
in those lines.

## Step 5 — bisect by halving

When the cause is somewhere in a large space — which of forty handlers, which
of six hundred lines, which of two commits — halve it. Take the first half of
the space, test it, and keep the half that still reproduces. Repeat. Twenty
lines become ten, five, two, one.

The same applies to the data: halve the records, or replace the suspect record
with a minimal one, and see whether the failure survives. The office's
`graphify-out/` graph answers the "which file" question without loading the
files — `GRAPH_REPORT.md` and `graph.json` map them.

## The trap this codebase fell into

A guard compared `t.projectId !== project.projectId` when the project record's
field is actually `id`. The comparison was against `undefined`, so it never
fired: the invariant it protected was silently unprotected, and a project
reached `done` on evidence from *another* project's task. Nothing raised, no
log line appeared, and every test that did not specifically drive a foreign
task through the gate still passed.

The general form: **a guard must be checked against the real field names of
the object it guards, and against real data at the boundary.** Before trusting
a guard, open the record and confirm the field exists on it and holds the
value you expect. A guard that compares a field the object does not have is
inert — and an inert guard is worse than no guard, because it reads as
protection.

## Step 6 — verify against the original failure

A fix is verified against the ORIGINAL failure, not against a nearby success.
Reproduce the original defect first; confirm it still fails. Apply the fix.
Confirm the original defect no longer reproduces. Then confirm the neighbouring
behaviour still holds, by running the suites the change touches. A fix that
makes a new test pass while the original failure persists is not a fix. A fix
that passes the original failure but breaks the suite is not done.

Run the suites and report the real `N passed, M failed` line for each:

```
node tools/project_pipeline_test.js
node tools/agency_transition_test.js
node tools/agency_rules_test.js
```

For the procedure that decides which cases to write, load the `testing-strategy`
skill.

## Outputs

- The confirmed mechanism, with the file and line where it happens.
- The evidence that demonstrates it — a reproduction, a trace, or a state diff.
- The fix, verified by the original failure no longer reproducing.
- The real output of every suite run, and any check that was skipped.

## Common mistakes

- Fixing the symptom — catching the refusal at the HTTP layer rather than
  fixing the decision that produced it.
- Reporting a hypothesis as a finding because it is the most plausible story.
- Reading only the last frame of the trace.
- Halving by guessing instead of by testing half the space.
- Accepting a fix because a new test passes, without re-running the original
  reproduction.
- Declaring the root cause from the log line alone, without opening the
  record the guard compares against.