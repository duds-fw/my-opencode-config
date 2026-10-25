---
name: requirements-analysis
description: "Turn an owner ask into acceptance criteria the project pipeline will accept — falsifiable claims that pass isFalsifiableCriterion and satisfy P2, with the right accepting role."
---

# Turn an ask into acceptance criteria the pipeline accepts

The office accepts a project on a typed binary checklist, not on free text.
This procedure produces criteria that pass `isFalsifiableCriterion`, carry the
right accepting role, and can be evidenced later.

## 1. Separate the goal from the criteria

- **Goal** → `project.goal`. A purpose, freely worded. Never verified.
- **Criterion** → `project.acceptanceCriteria[]`. One claim that is true or
  false about the finished outcome, with evidence.

If the ask cannot be written as a checkable sentence, it is a goal — put it in
`project.goal` and keep looking for the observable thing the client receives.

## 2. Know the difference between a criterion and a task

| | Criterion | Task |
|---|---|---|
| Lives in | `project.acceptanceCriteria[]` | `tasks[]` |
| Asserts | a property of the delivered outcome | a unit of work |
| Shape | `{id, text, met, metBy[], evidence}` | title, phase, role, estimate, sprint, status, deliverable |
| Ends by | `met: true` + a `metBy` task that is `done` | `status: 'done'` + `deliverable.summary` (P3) |

`"Fix the login bug"` is a task. `"The login endpoint returns 401 for an expired
token"` is a criterion. One criterion may rest on several tasks (`metBy[]`); one
task may serve several criteria. A criterion never names who does the work —
the delivery role follows the phase, and that role may not accept the result
(P7).

## 3. Apply the falsifiability test

`isFalsifiableCriterion(text)` in `project-pipeline.js` is structural, not
semantic — it cannot judge whether a sentence is checkable in the abstract, so
the semantic work is yours. A text passes only if **all** of these hold: it is
a string, non-empty after trimming, **at most 300 characters**; it is exactly
**one** sentence (split on `.`/`!`/`?` followed by space or end); it is **at
least 12 characters** long; it contains **no goal language**; it contains **no
comparative or qualitative claim**; and it names a **checkable subject** — an
endpoint, file, module, commit, test, UI component, config option, metric, log,
user, role, permission, record, table, error code or exit code.

The two word lists and Rule 6's exact subject families, verbatim from the
source, are in `references/falsifiability.md` — read it when a criterion is
borderline.

Rules 4 and 5 are why **"make it good"** and **"the API is fast"** are refused:
the first names no checkable subject, the second names a real one but states no
threshold. A criterion names the threshold itself.

## 4. Refuse and rewrite

Each right-hand text below was run through `isFalsifiableCriterion` and passes.
The refused/rewrite pairs are in `references/falsifiability.md`; the pattern is
to name a checkable subject and state the threshold itself.

When a request resists rewriting, say which part is the goal and which is the
measurable part. Do not ship the vague form — `validateChecklist` refuses it
with `criterion_not_falsifiable`, and the project cannot leave `triaged` (P2).

## 5. Check who may accept

`ACCEPTOR_ROLES` is `['product_owner_product_manager', 'client']` (P8). The
accepting role must also differ from every role that produced a `metBy` task
(P7) — the office may not accept its own work.

- **Verification** — Quality Assurance (`quality_assurance`) marks each criterion
  `met`/`unmet` against evidence. QA produces the verdict; QA does not decide.
- **Decision** — the Product Owner (`product_owner_product_manager`) accepts or
  requests changes. The PO wrote the criteria and owns scope.
- **Ratification** — the owner, only when acceptance would change scope, budget
  or accepted risk.

A criterion the producing role will also verify cannot be accepted cleanly:
plan the evidence so a second role can check it.

## 6. Record the checklist so P2 holds

Write the checklist with **ids and text only** — never `met`, `evidence` or
`metBy`. The two worked calls — `agency.setAcceptanceCriteria` and
`agency.verifyCriterion` — are in `references/checklist-write.md`.

What this guarantees:

- `setAcceptanceCriteria` normalises every entry through `normaliseCriterion`,
  which **discards** caller-supplied `met`, `metBy` and `evidence` and forces
  `met: false`, `metBy: []`, `evidence: null`. A checklist is a plan of what will
  be checked, never a self-asserted verdict.
- `validateChecklist` refuses an empty list (`no_acceptance_criteria`), a
  non-falsifiable text (`criterion_not_falsifiable`), a missing id and a
  duplicate id.
- Only then may the project leave `triaged` (P2).

Verification is a **separate authorised step**: see `references/checklist-write.md`
for the worked `agency.verifyCriterion` call, the evidence limit (≤ 2000
characters), the `criterion_unverified` and `criterion_frozen` refusals, and the
honest repair — request changes, which returns the project to `planning` and
clears the verdicts.

## Outputs

- The goal, in `project.goal` wording
- A numbered checklist of `{id, text}` where every text passes
  `isFalsifiableCriterion`
- The accepting role, and the verifying role, named
- Any request that could not be made falsifiable, with the reason

## Common mistakes

- Accepting "make it good" because it reads like a goal and moving on
- A criterion that names no subject, so nothing can ever evidence it
- Writing `met: true` into the checklist — it is discarded, and it signals a
  forged intent
- Letting the delivering role verify and accept its own work (P7)
- Turning a task title into a criterion
