# The `docs/` inventory

Check `docs/` before writing. The office's documents live flat in `docs/`, named
in kebab-case with a prefix that states the kind of document.

## Naming rules — the prefix states the kind

- `design-<subject>.md` — a design: the problem, the model, the API contract,
  the plan. `design-project-pipeline.md`, `design-api-identity.md`,
  `design-escalation-panel.md`.
- `agency-<subject>.md` — the office's own record: decisions, data model,
  requirements, security review. `agency-decisions.md`,
  `agency-data-model.md`, `agency-requirements.md`,
  `agency-security-review.md`.
- `sop-virtual-office.md` — the standing procedure.
- `role-guidelines.md` — per-role detail.
- `sprint-<n>-retrospective.md` — a retrospective.

Never add a document whose kind is not one of these.

## What each file holds

| File | Kind | Holds |
|---|---|---|
| `design-project-pipeline.md` | design | The six-stage pipeline: RACI, stage semantics, data-model changes, invariants P1-P9, the intended API contract (§5), isolation between projects, the phased plan, and the owner's decisions D1-D4. |
| `design-api-identity.md` | design | API and identity design. |
| `design-escalation-panel.md` | design | The escalation panel surface. |
| `agency-decisions.md` | decision record | `## D<n>` headings, each with the decision and its reasoning. D7 covers the project pipeline: D7.1 budget, D7.2 acceptance authority, D7.3 criteria type, D7.4 multi-project. Decisions are appended, never rewritten. |
| `agency-data-model.md` | office record | The data model. |
| `agency-requirements.md` | office record | The requirements list (currently 52 bytes — a stub). |
| `agency-security-review.md` | office record | The security review. |
| `sop-virtual-office.md` | procedure | The standing procedure, clause-numbered. A **draft** awaiting the owner's review. |
| `role-guidelines.md` | role detail | Per-role guidance, each role naming the SOP clauses that bind it. A **draft** awaiting the owner's review. |
| `sprint-2-retrospective.md` | retrospective | What a sprint's retrospective changed. |

## Authority order

`agency.js` is the mechanism → `docs/agency-decisions.md` is the authority →
`docs/sop-virtual-office.md` is the procedure → `docs/role-guidelines.md` is
the role detail. A conflict escalates at L2 (Orchestrator); a conflict that
would change an owner decision escalates to the owner.

`AGENTS.md` in the repo root states the pipeline standing rule and points at
`docs/design-project-pipeline.md` and `docs/agency-decisions.md` §D7. It
overrides the SOP and role guidelines, which are drafts.

## Verifying a claim before you write it

Open the source and check. Current facts, as of this writing:

- `server.js` contains **no** reference to `project-pipeline.js`. The pipeline
  is required by `agency.js` only. Any document claiming the pipeline is
  wired into the HTTP surface is wrong.
- `docs/design-project-pipeline.md` §5 lists eleven project endpoints. Only
  `POST /api/agency/project` is registered in `server.js`. The rest are design
  intent. `GET /api/agency/timeline`, `/api/agency/projects` and every
  `project/:id/*` route are absent from the server.
- Live routes are registered as `pathname === '/api/agency/...' &&
  req.method === '...'` comparisons in `server.js`. Copy the literal.
- `docs/agency-requirements.md` is a 52-byte stub — do not treat it as the
  requirements source.

## The consistency check

`tools/sop-consistency-check.js` reads the real values out of `agency.js` and
asserts that `docs/sop-virtual-office.md` and `docs/role-guidelines.md` match.
It checks facts, not prose. Run it after editing either document:

```
node tools/sop-consistency-check.js
```

When a document's claim and the code disagree, the document is wrong. Fix the
document in the same change that broke it.
