# Missing pipeline regressions

Five cases have no coverage in `tools/` today. Each was a real defect in this
codebase's history. Write the case when the related code is touched.

All five share one property: the bad case **succeeds**. The code path returns
`ok: true`, no error surfaces, and nothing in the office's output separates the
good case from the bad one. That is why they pass silently.

---

## 1. Cross-project contamination

**Invariant:** P4 — a project reaches `done` only when every criterion is met
and every referenced task is done *and belongs to that project*.

**Code path:** `project-pipeline.js` `checkDoneGates()` compares each cited
task's `projectId` against `project.id` (the project record's field is `id`,
not `projectId`). `agency.js` `verifyCriterion()` additionally refuses a
`metBy` task that is not one of the project's own tasks, with
`reason: 'criterion_unverified'`.

**Why it matters:** this guard once compared `t.projectId !== project.projectId`
— a field the project record does not have. The comparison was against
`undefined`, so it never fired and a project reached `done` on another
project's completed work.

**Check to write:**

```js
const own = doneTask(p.id, 'Own work');
const foreign = doneTask(otherProjectId, 'Foreign work');
// cite the foreign task as evidence, then try to close the project
const v = agency.verifyCriterion(p.id, 'c1', true, 'sha abc1234', { metBy: [foreign.id] });
check("another project's task is not evidence for this project",
  v.ok === false && v.reason === 'criterion_unverified', JSON.stringify(v));
```

Also assert the pipeline rule directly, which is where the field name matters:

```js
const g = pipeline.checkDoneGates(project, { [foreign.id]: foreignTask });
check('a task from another project does not satisfy the done gate',
  g.ok === false && /another project/i.test(JSON.stringify(g.errors)), JSON.stringify(g));
```

---

## 2. Forged acceptance

**Invariant:** P2/P7 — a checklist is a plan of what will be checked; the
verdict is reached separately and by an authorised role.

**Code path:** `project-pipeline.js` `normaliseCriterion()` builds every
criterion as `{ id, text, met: false, metBy: [], evidence: null }` and ignores
the caller's verdict fields. `agency.js` `setAcceptanceCriteria()` maps every
input through it.

**Why it matters:** `setAcceptanceCriteria` once accepted caller-supplied
`met: true`, `evidence` and `metBy`, so acceptance could be forged at the
write boundary — a client asked to *set a checklist* was handing the office a
verdict.

**Check to write:**

```js
agency.setAcceptanceCriteria(p.id, [
  { id: 'c1', text: 'The endpoint returns status code 204', met: true, evidence: 'forged', metBy: ['task_x'] },
]);
const c = agency.projectDetail(p.id).project.acceptanceCriteria[0];
check('a caller-supplied verdict is discarded on write',
  c.met === false && c.evidence === null && c.metBy.length === 0, JSON.stringify(c));
```

---

## 3. Re-verification after acceptance

**Invariant:** a decision that has been made is not rewritten from the back.

**Code path:** `agency.js` `verifyCriterion()` returns
`reason: 'criterion_frozen'` when the project is in `acceptance` or `done`,
and also when a criterion is already `met` with a `verifiedAt` stamp and is
being re-pointed at different evidence. Un-verifying (marking it unmet again)
is deliberately allowed.

**Why it matters:** a criterion could be re-verified after acceptance,
rewriting a decision that had already been made — and, before the freeze,
re-pointing a met criterion at different evidence.

**Checks to write:**

```js
// after the project reaches acceptance
const again = agency.verifyCriterion(p.id, 'c1', true, 'sha different', { metBy: [] });
check('a criterion cannot be re-verified after acceptance',
  again.ok === false && again.reason === 'criterion_frozen', JSON.stringify(again));

// while still in delivering, a met criterion may not be re-pointed
const repoint = agency.verifyCriterion(p.id, 'c1', true, 'sha other', { metBy: [] });
check('a met criterion may not be re-pointed at different evidence',
  repoint.ok === false && repoint.reason === 'criterion_frozen', JSON.stringify(repoint));
```

---

## 4. Deliverable rewritten after `done`

**Invariant:** P3 — the deliverable names what the task produced. Once the
task is `done`, that claim is certified and must not be rewritten.

**Code path:** `agency.js` `updateTask()` writes `t.deliverable` whenever the
patch carries one, with no check on `t.status`. `setTaskStatus()` checks the
deliverable only on the way *into* `done`.

**Why it matters:** a deliverable could be rewritten after a task was `done`,
retroactively changing the claim that was certified — and, through P4, the
evidence a closed project rests on.

**Note:** this is a live gap, not a stale one. Nothing in the current code
refuses the rewrite. Write the test first, then close the gap; a test asserting
the current (wrong) behaviour is worse than no test.

**Check to write:**

```js
agency.setTaskStatus(t.id, 'done', 'shipped');
const rewrite = agency.updateTask(t.id, { deliverable: { kind: 'code', summary: 'Something else entirely', ref: 'def5678' } });
check('a deliverable cannot be rewritten after the task is done',
  rewrite.ok === false, JSON.stringify(rewrite));
const stored = agency.state().tasks.find((x) => x.id === t.id).deliverable;
check('the certified deliverable is unchanged',
  stored.summary === 'Shipped it', JSON.stringify(stored));
```

---

## 5. Bogus commit SHA

**Invariant:** the house rule — a `kind: 'code'` deliverable must carry the
commit SHA in `deliverable.ref`.

**Code path:** `agency.js` `updateTask()` refuses an empty `ref` with
`reason: 'missing_deliverable_ref'`, but performs no shape check on the value.

**Why it matters:** a `ref` of `'x'` was accepted as a commit SHA. The
certification then points at nothing, and the office's own recoverability
standard cannot be checked.

**Note:** this is a live gap. A `ref` of `'x'` is accepted today.

**Check to write:**

```js
const bogus = agency.updateTask(t.id, { deliverable: { kind: 'code', summary: 'It works', ref: 'x' } });
check('a bogus commit SHA is refused',
  bogus.ok === false, JSON.stringify(bogus));
```

Decide the accepted shape before writing the test — a full 40-hex SHA, or the
7-to-40 hex short form git prints — and state the choice in the label.

---

## Where these belong

- Case 1, 3 → `tools/agency_transition_test.js` (P4 and P7 groups) or
  `tools/project_pipeline_test.js`.
- Case 2 → `tools/project_pipeline_test.js` (the `setAcceptanceCriteria` block).
- Case 4, 5 → `tools/agency_rules_test.js` (the deliverable and status block)
  or `tools/project_pipeline_test.js`.

Every case needs the isolated `AGENCY_STATE_DIR` block and its own fixture.
