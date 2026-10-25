# Stage ownership and legal transitions

Read this before moving a project between stages or deciding who may accept
what. The mechanism is `project-pipeline.js`; this file is the readable map.

## The six stages

**Registration → Triage → Planning → Delivery → Acceptance → Done**

Stored project statuses (`PROJECT_STATUSES` in `project-pipeline.js`):
`registered`, `triaged`, `planning`, `delivering`, `acceptance`, `done`,
`cancelled`.

`active` is a **derived alias, never stored** — `planning` and `delivering`
are the active statuses. A query that filters on `active` must expand it to
those two statuses; storing `active` is a bug.

## Legal transitions

| From | To |
|---|---|
| `registered` | `triaged`, `cancelled` |
| `triaged` | `planning`, `cancelled` |
| `planning` | `delivering`, `cancelled` |
| `delivering` | `acceptance`, `cancelled` |
| `acceptance` | `done`, `planning`, `cancelled` |
| `done` | — |
| `cancelled` | — |

`acceptance → planning` is the **rework path**: acceptance can send work back
rather than only closing it. Any other move is `illegal_project_transition`.

`done` and `cancelled` are terminal.

## Who owns which stage (RACI)

| Stage | Accountable role |
|---|---|
| Registration | the owner |
| Triage | Product Owner (`plan`) |
| Planning | Product Owner + Orchestrator |
| Delivery | phase-matched roles |
| Acceptance — verify | Quality Assurance (`tester`) |
| Acceptance — decide | Product Owner (`plan`) |
| Acceptance — ratify | the owner, **only** when acceptance would change scope, budget or accepted risk |
| Done | Orchestrator |

**Acceptance is two acts, not one.** QA marks each criterion `met`/`unmet`
against evidence. The Product Owner then accepts or requests changes. Do not
merge them, and do not accept on the owner's behalf without ratification.

The owner ratifies only when acceptance would change scope, budget, or
accepted risk. Everything else is the office's own authority to decide.

## Acceptance is server-derived

A request body carries **raw input only**. It must never carry `met`,
`evidence`, `metBy`, or the acting role. Those are computed server-side:

- `setAcceptanceCriteria` normalises every criterion to `met: false`,
  `metBy: []`, `evidence: null` on write.
- Verification is a separate, authorised step.
- The accepting role is derived from server state, never read from the body —
  `ACCEPTOR_ROLES = ['product_owner_product_manager', 'client']`, and `client`
  is not a roster matrixRole, so a body-supplied `actingRole` is forgeable.

A criterion is **frozen** once verified: re-verification is refused in
`acceptance` and `done` (`criterion_frozen`). A decided decision is not
rewritten in place — the pipeline moves instead.
