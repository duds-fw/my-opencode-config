# The forgery defect, before and after

`setAcceptanceCriteria` once wrote the caller's verdict into the stored
checklist:

```js
// BEFORE — the caller supplied the conclusion.
project.acceptanceCriteria = criteria.map((c, i) => ({
  id: c.id || `ac_${i + 1}`,
  text: String(c.text || '').trim(),
  met: c.met === true,             // caller-supplied verdict
  metBy: Array.isArray(c.metBy) ? c.metBy : [],
  evidence: c.evidence || null,    // caller-supplied evidence
}));
```

Now `project-pipeline.js` `normaliseCriterion` builds the stored shape and
forces every verdict field to "not yet decided":

```js
// AFTER — only the raw claim survives the boundary.
function normaliseCriterion(raw, index) {
  return {
    id: raw.id || `ac_${index + 1}`,
    text: String(raw.text || '').trim(),
    met: false,
    metBy: [],
    evidence: null,
  };
}
```

`agency.js` `setAcceptanceCriteria` maps `pipeline.normaliseCriterion` over
the caller's array, validates it with `pipeline.validateChecklist`, and only
then stores it. Every new write path follows the same shape: **normalise
(force the verdict fields) → validate the raw input → store**.

## The two sibling defects the same pattern stops

- A criterion could be re-verified after acceptance, rewriting a decision that
  had already been made — now refused with `criterion_frozen`.
- A deliverable could be rewritten after a task was `done`, retroactively
  changing the claim that was certified — `agency.js` `updateTask` still
  accepts it and is an open gap.
