---
name: testing-strategy
description: "Derive test cases from acceptance criteria and pipeline invariants in the office's plain-Node harness, and run the suites before calling a change done."
---

# Derive and run the office's test cases

Produces a `tools/<subject>_test.js` suite that proves a change, plus the real
output of running it. Use this when acceptance criteria, an invariant P1-P9, or
a bug fix must be proven rather than asserted.

## The house harness

There is no test framework and no `npm test`. Every suite is a plain Node
script in `tools/`, run directly with `node tools/<subject>_test.js`. It owns
a counter and a `check(label, cond, detail)` helper, prints one `PASS` or
`FAIL` line per case, and ends with `N passed, M failed` and
`process.exit(fail === 0 ? 0 : 1)`.

`label` states what was proven in plain words, `cond` is the assertion, and
`detail` prints only on failure — put the offending value there
(`JSON.stringify(result)`). Two helpers are also house style: `must(cond,
message)` throws when a precondition breaks (a broken setup is a broken suite,
not a failed invariant — `tools/agency_transition_test.js`), and `skipped(label,
why)` prints `SKIP` for a check that could not run
(`tools/vocabulary_test.js`). See `references/harness-template.md` for the
copy-paste skeleton.

## Derive one case per acceptance criterion

A criterion is one falsifiable claim, so it is one case. Ask what observable
would prove it true and what observable would prove it false; both become
checks. A criterion is written through `agency.setAcceptanceCriteria` and
settled by `agency.verifyCriterion`, so the case exercises that path, not the
validator alone.

A refusal carries a stable `reason` code — assert that, not the `errors`
prose: `project_not_registered`, `no_acceptance_criteria`,
`criterion_not_falsifiable`, `missing_deliverable`, `illegal_project_transition`,
`acceptance_not_met`, `criterion_unverified`, `self_acceptance`,
`acceptor_not_authorised`.

## Derive one case per invariant

`tools/agency_transition_test.js` already carries one labelled group per
invariant P1-P9 (`check('P1 ...')` through `check('P9 ...')`). Extend those
groups or add a sibling file rather than restating them. P5 is task-to-sprint
project agreement, P6 is `agency.metrics(projectId)` being project-scoped, P7
is the producing role not accepting its own evidence, P8 is only
`product_owner_product_manager` or `client` accepting, P9 is the Orchestrator
not skipping a stage.

## Cover four axes for every guard

1. **Happy** — the legitimate case is allowed through.
2. **Refusal** — the illegitimate case is refused with the right reason code.
3. **Boundary** — the edge value is judged by the same rule (empty checklist,
   one criterion met of two, a cited task `done` versus not).
4. **Cross-project** — a record belonging to another project is refused. This
   axis is what catches a guard comparing the wrong field name.

## Where the test belongs

`tools/<subject>_test.js`, named for the subject: `project_pipeline_test.js`,
`agency_rules_test.js`, `agency_transition_test.js`, `vocabulary_test.js`,
`read_path_purity_test.js`. A consistency audit rather than a suite may use a
hyphenated name (`tools/sop-consistency-check.js`). Assert through the public
surface — `agency.*` for runtime behaviour, `pipeline.*` for the rules.

## Worked example: one criterion, three checks

Criterion: `The login endpoint returns 401 for an expired token`.

```js
const p = agency.createProject({ name: 'Auth', goal: 'Prove 401', budgetHours: 20 });
agency.transitionProject(p.id, 'triaged', { actingRole: PO });
agency.setAcceptanceCriteria(p.id, [{ id: 'c1', text: 'The login endpoint returns 401 for an expired token' }]);
agency.transitionProject(p.id, 'planning', { actingRole: PO });

// 1. refusal — no evidence, no verdict.
const noEvidence = agency.verifyCriterion(p.id, 'c1', true, null, { metBy: [] });
check('a criterion cannot be met without evidence',
  noEvidence.ok === false && noEvidence.reason === 'criterion_unverified', JSON.stringify(noEvidence));

// 2. happy — evidence settles it.
const verified = agency.verifyCriterion(p.id, 'c1', true, 'sha abc1234', { metBy: [] });
check('evidence settles the criterion', verified.ok === true &&
  agency.projectDetail(p.id).project.acceptanceCriteria[0].met === true, JSON.stringify(verified));

// 3. cross-project — another project's task is not this project's evidence.
const other = agency.createProject({ name: 'Other', goal: 'g', budgetHours: 10 });
const foreignTask = agency.createTask({ title: 'Foreign', projectId: other.id,
  phase: 'Design', role: 'ui_ux_designer', estimateHours: 2 });
const foreign = agency.verifyCriterion(p.id, 'c1', true, 'sha def5678', { metBy: [foreignTask.id] });
check("another project's task is not evidence for this project",
  foreign.ok === false && foreign.reason === 'criterion_unverified', JSON.stringify(foreign));
```

## Done means the suite ran

A change is not finished until the affected suites have been run and the real
output reported:

```
node tools/project_pipeline_test.js
node tools/agency_transition_test.js
node tools/agency_rules_test.js
```

Report the `N passed, M failed` line from each. If a suite could not be run,
say which and why — never report a result you did not observe.

## Outputs

- A suite at `tools/<subject>_test.js` whose labels name the behaviour proven.
- The real `N passed, M failed` output of every suite run.

## Common mistakes

- Asserting on the `errors` prose instead of the stable `reason` code.
- Pointing `AGENCY_STATE_DIR` at the live `state/` directory.
- Testing the happy path only, so a guard that never fires still passes.
- Sharing a project or task across cases, so one case's state decides the next.
- Reporting "tests pass" without the summary line from an actual run.