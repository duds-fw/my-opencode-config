# Writing the checklist and verifying a criterion

## The checklist write — ids and text only

Write the checklist with **ids and text only** — never `met`, `evidence` or
`metBy`:

```js
agency.setAcceptanceCriteria(projectId, [
  { id: 'c1', text: 'the endpoint returns status code 204 for a request with an expired token' },
  { id: 'c2', text: 'the pipeline test returns exit code 0' },
]);
```

What this guarantees:

- `setAcceptanceCriteria` normalises every entry through `normaliseCriterion`,
  which **discards** caller-supplied `met`, `metBy` and `evidence` and forces
  `met: false`, `metBy: []`, `evidence: null`. A checklist is a plan of what will
  be checked, never a self-asserted verdict.
- `validateChecklist` refuses an empty list (`no_acceptance_criteria`), a
  non-falsifiable text (`criterion_not_falsifiable`), a missing id and a
  duplicate id.
- Only then may the project leave `triaged` (P2).

## Verification is a separate authorised step

```js
agency.verifyCriterion(projectId, 'c1', true, 'node tools/project_pipeline_test.js → 0 failed', {
  metBy: ['task_abc123'],   // this project's own tasks only
});
```

`verifyCriterion` requires non-blank evidence (≤ 2000 characters) for
`met: true`, refuses `metBy` ids that are not this project's tasks, and returns
`criterion_unverified` when any of that is missing. A verified criterion is
frozen — re-pointing it at different evidence is refused with
`criterion_frozen`; the honest repair is to request changes, which returns the
project to `planning` and clears the verdicts.
