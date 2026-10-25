# The ADR form

Copy this verbatim and fill it in. It fixes the heading, the
`Status`/`Date`/`Deciders` header, and the four sections.

```markdown
# ADR-0001 — <the decision, in one line>

- Status: proposed | accepted | superseded by ADR-NNNN
- Date: YYYY-MM-DD
- Deciders: <roles that made the call>

## Context

The forces at play: the requirement, the constraint, the conflict. Facts and
file paths, not narrative. Name the invariant or the contract at stake.

## Decision

What was decided, in the present tense. Precise enough that a reader can tell
whether a proposed change violates it.

## Rejected alternatives

- <alternative> — why it lost, in one line.

## Consequences

- What this makes easier.
- What this forbids or makes harder.
- What would make this decision wrong, and who would notice.
```

## Notes on filling it in

- **Context** states forces, not story. The reader needs the invariant or the
  contract at stake, not the meeting where it was discussed.
- **Decision** is in the present tense and is falsifiable — a reader must be
  able to tell whether a proposed change violates it.
- **Rejected alternatives** are the ones that actually lost, with the reason
  in one line each. An ADR with no rejected alternative is usually a
  description of a decision nobody argued about.
- **Consequences** includes what would make the decision wrong and who would
  notice. A decision with no failure condition cannot be revisited.
