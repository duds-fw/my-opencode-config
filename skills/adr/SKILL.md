---
name: adr
description: "Record an architecture decision as an ADR in the office's docs/: when one is warranted, the context/decision/consequences format, and where it lives."
---

# Write an architecture decision record

An ADR captures one choice the office made, the alternatives it rejected, and
what the choice costs. It is written when the decision is made — not after the
code shipped.

## 1. Decide whether a record is warranted

| | Use |
|---|---|
| **ADR** | the decision constrains future work across more than one file or role; at least two alternatives were reasonable; reversing it is expensive; a future reader would otherwise re-litigate it |
| **Code comment** | a "why" that lives inside one function — which field is real, why a guard is ordered this way, what a null means. It dies with the code, which is correct |
| **`docs/agency-decisions.md`** | an **owner's** decision — scope, budget, acceptance authority, priority. The office's engineering decisions are ADRs; the owner's are decision-log entries (`## D1 — … → **answer**`) |
| **Design doc** (`docs/design-*.md`) | the shape of a whole system — RACI, data model, invariants, API contract. An ADR is one choice *inside* that shape |
| **Lesson** (`agency.recordLesson`) | what the retrospective changed, tied to a sprint |
| **Journal** (`activity-journal.js`) | what the office actually did, appended at runtime |

Real examples of ADR-grade choices: the six-stage project machine and P1–P9;
the engine/UI separation (D9); the read-path purity rule (F-17, "a read must
never write"). If the decision only shapes one function, write a comment.

## 2. Write it when the decision is made

- Before the change lands, not after. An ADR dated after the code shipped is a
  fiction: it describes a choice that never had one.
- If the code already embodies the decision and no record was made, write it
  now with **today's** date and say plainly that the code already implements it.
  Never backdate it.
- One decision per file. Two decisions means two ADRs.

## 3. Use the format

Copy the form from `references/adr-template.md` and fill it in. It fixes the
heading (`# ADR-NNNN — <the decision, in one line>`), the
`Status`/`Date`/`Deciders` header, and the four sections — `Context`,
`Decision`, `Rejected alternatives`, `Consequences`.

`Status` is `proposed` while it is being argued, `accepted` once it is in force,
and `superseded by ADR-NNNN` when a later ADR replaces it. **Never edit an
accepted ADR to change the decision** — write the new ADR and mark the old one
superseded. The old file stays, so the reasoning that was once load-bearing is
still readable.

This vocabulary is the office's own convention, defined here — there is no
external standard behind it and the owner has not ratified it. The first ADR
the office actually writes makes it binding; until then treat `proposed` as the
only status in force and escalate any use of `accepted` to the owner.

## 4. Put it where the office will find it

`docs/` is flat and kebab-case: `agency-data-model.md`, `agency-decisions.md`,
`design-api-identity.md`, `design-project-pipeline.md`, `role-guidelines.md`,
`sop-virtual-office.md`. There is no `docs/adr/` directory.

So an ADR is:

```
docs/adr-0001-<decision-slug>.md
```

- Number sequentially, zero-padded to four digits. The slug names the
  *decision* (`criterion-verification-is-separate-from-acceptance`), not the
  system it touches.
- The `adr-` prefix keeps ADRs distinct from the owner's `D1…D9` sequence in
  `docs/agency-decisions.md`, which stays where it is.
- Link the ADR from the code that embodies it: a one-line comment
  `// ADR-0001 — <decision>` on the rule, so a reader of the code finds the
  reasoning.

## 5. Keep the authority order

`AGENTS.md` sets the precedence: `agency.js` is the mechanism,
`docs/agency-decisions.md` is the authority, the SOP is the procedure, the role
guidelines are role detail. An ADR explains the office's own engineering
choice — it may not contradict the owner's decisions. A conflict escalates at L2
(Orchestrator); a conflict that would change an owner decision escalates to the
owner.

## 6. An ADR is not a task list

It records **one decision and the alternatives it beat**. It does not hold
steps, estimates, owners or checkboxes — those belong to the sprint and the
task. A reader who wants to know *what to do next* must not have to parse an
ADR to find it.

## Outputs

- `docs/adr-NNNN-<slug>.md`, following the format above
- Status, date and deciders filled in honestly
- A one-line comment at the code that implements it
- A note of anything that was left open

## Common mistakes

- Writing the ADR after the change, dated as if it came first
- Recording what was built rather than what was chosen
- Listing tasks and estimates inside the ADR
- Rewriting an accepted ADR instead of superseding it
- Numbering an ADR inside the owner's `D1…D9` decision log
- Leaving out the rejected alternatives, which is the part worth keeping
