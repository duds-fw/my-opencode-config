# Known defects — the mechanisms behind the invariants

Six real defects this office shipped. Each maps to an invariant in
`SKILL.md`. Read this before writing a guard, a migration or an acceptance
path — the failure modes repeat, they are not new each time.

## 1. The inert guard (P4, P5, P7)

`checkDoneGates` compared `t.projectId !== project.projectId` when the project
record's field is actually `id`. The comparison was always false, so the
guard never fired, P4 was unprotected, and a project reached `done` on
evidence produced for a *different* project's task.

It now reads `t.projectId !== project.id`.

**Lesson:** check the field names that actually exist on the object you are
guarding. A guard that compares a field the record does not have is
indistinguishable from no guard at all — and it looks correct in review.

**Check for it:** for every new guard, ask "can this ever be true?" If the
comparison cannot produce the bad case, the guard is decoration.

## 2. The forged acceptance (P2, P8)

`setAcceptanceCriteria` accepted caller-supplied `met: true`, `evidence` and
`metBy`. A caller could assert that a criterion was met, attach whatever
evidence it liked, and name the task that supposedly produced it — forging
the acceptance at the write boundary.

`normaliseCriterion` now forces `met: false`, `metBy: []`, `evidence: null`
on write. Verification is a separate, authorised step.

**Lesson:** a write path takes raw input and validates it. It must never
take a caller's word for a *verified outcome*. Raw input is the caller's
business; the conclusion is the server's.

## 3. The re-verified acceptance

A criterion could be re-verified after the project had been accepted,
rewriting a decision that had already been made and communicated.

A criterion is now frozen once verified; re-verification is refused in
`acceptance` and `done`.

**Lesson:** a decision that has been made must not be rewritten in place. If
the answer changed, the pipeline moves — `acceptance → planning` — it does
not overwrite history.

## 4. The rewritten deliverable (P3)

A deliverable could be edited after the task had been marked `done`,
retroactively changing the claim that had been certified against it. The
evidence and the claim drifted apart.

**Lesson:** a certified artefact is immutable. If the deliverable is wrong,
the task is reopened — the deliverable is not quietly corrected under the
certification.

## 5. The bogus commit SHA

`deliverable.ref` accepted the value `'x'` as a commit SHA. The office
closed a code task against a reference that resolved to nothing.

**Lesson:** a SHA is a *reference to something that exists*, so its format
and its resolution must be checked:

```bash
git cat-file -e <sha>^{commit} && echo "sha resolves"
```

Treat an unresolvable SHA as a failed check, not a formality.

## 6. The silent migration

A migration encountered a status it did not recognise and downgraded it to
`registered`, discarding the original value. The record looked valid and the
information was gone.

**Lesson:** a migration must preserve the value it did not understand. Keep
the original, surface it, and fail loudly if it is genuinely unhandleable.
Downgrading an unknown state to a default is data loss disguised as a
migration.

## The shared pattern

Every one of these is the same mistake in a different costume: **a check
that cannot fire, or a value that was never checked.**

- Compare the fields that exist.
- Derive conclusions from server-side state.
- Make certified artefacts immutable.
- Preserve what you do not understand.
- Verify a reference resolves.

When you add a guard, ask what it would catch. If you cannot answer, it is
not a guard.
