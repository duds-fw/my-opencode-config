---
name: test-quality
description: "Judge whether an office test is worth keeping — deterministic, isolated, asserting returned values — and write the pipeline regression cases that are still missing."
---

# Keep only the tests that can fail

A test is worth keeping when it fails when the behaviour breaks and passes
every time otherwise. This procedure decides that, and names the pipeline
regressions that currently have no test at all.

## Determinism

- No wall-clock. The office derives escalation levels from elapsed time
  (`AGENCY_ESCALATION_MS`); set the window explicitly before requiring
  `agency.js` rather than sleeping for a real duration.
- No network. A suite never calls the API and never binds a port.
- No unseeded randomness. Fix the seed, or generate the value from an index.
- No dependence on live `state/`. `AGENCY_STATE_DIR` points at a temp path
  the suite creates and clears itself.

A test that passes on a fast machine and fails on a loaded one is broken, not
flaky. `tools/agency_rules_test.js` documents the real version of this: a 40ms
escalation window was missed by a couple of milliseconds, so the window is 1s.

## Isolation

Each case builds its own state: its own project, its own task, its own sprint.
Never mutate `state/` in a test — the server holds it in memory and rewrites
it on every tick, so a test that writes there corrupts the live office and
its own result. Use the temp fixture directory and let the case create what it
needs.

Two cases must never share a project, a task, or a criterion id. A shared
fixture means one case's state decides the next case's outcome, and the suite
starts failing for reasons no one can reconstruct.

## Assert on returned values, not on logs

The office returns a verdict object; assert on it. `agency.transitionProject`
gives `{ ok: false, reason, errors }` — assert `reason === 'acceptance_not_met'`.
`agency.updateTask` gives `{ ok: false, reason }` — assert
`reason === 'missing_deliverable_ref'`. `pipeline.checkDoneGates` gives
`{ ok, reason, errors }` — assert `ok === false` and, where it matters, that
`errors` mentions the offending id.

Never assert on log text. `agency.setTaskStatus` writes through
`journal.append` and `logActivity`, but log prose is free-form and changes
without a behaviour change. A log assertion fails on a reworded message and
passes when the verdict is wrong.

## The regression coverage that is missing

Five cases have no test today, although each was a real defect. Write them
when the related code is touched. See `references/missing-regressions.md` for
the exact code path and a check to copy.

1. **Cross-project contamination.** A project must not reach `done` on another
   project's task evidence. The guard exists in `pipeline.checkDoneGates` and
   in `agency.verifyCriterion`, but no suite drives a foreign task into a
   done-gate.
2. **Forged acceptance.** `agency.setAcceptanceCriteria` must ignore a
   caller-supplied `met: true`, `evidence` and `metBy`.
3. **Re-verification after acceptance.** `agency.verifyCriterion` must refuse
   to re-settle a criterion once the project is in `acceptance` or `done`
   (`reason: 'criterion_frozen'`), and must refuse to re-point a met criterion
   at different evidence.
4. **Deliverable rewritten after `done`.** `agency.updateTask` accepts a new
   `deliverable` on a task that is already `done`, retroactively changing the
   claim that was certified. Nothing guards this today.
5. **Bogus commit SHA.** `agency.updateTask` requires a non-empty `ref` for a
   `kind: 'code'` deliverable but does not check its shape, so `ref: 'x'`
   passes certification.

Each of these is a silent pass if untested. A forged verdict and a wrong
project's evidence both *succeed* — the code path returns `ok: true`, no error
is raised, and nothing in the office's own output distinguishes the good case
from the bad one. A test that only asserts "the happy case still works"
cannot see them.

## What not to assert

- Implementation detail: private helpers, internal call order, the number of
  times a function is called.
- Log text and journal strings.
- Timing, unless the timing is the behaviour under test.
- Counts that belong to a previous case's fixture.

Assert the contract: the returned verdict, the stored record's field, and the
reason code on a refusal.

## Outputs

- A keep-or-drop verdict per test, with the reason.
- The missing regression cases written as `check()` calls in the suite that
  owns the surface.

## Common mistakes

- Asserting `result.errors[0]` instead of `result.reason`.
- Reusing one project across cases because setup is slow.
- Writing a test that only proves the happy path.
- Treating a skipped check as a passed check.
- Adding a case with no failing mode — if nothing could make it fail, it
  documents nothing.
