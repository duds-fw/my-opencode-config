---
name: engineering-gates
description: "The quality gates every code change must pass before it is called done, in the Virtual Office: what to check before, during and after a change, and what must never be claimed without evidence."
---

# Engineering Gates

The gates below apply to **every** change that touches code. They are not
advice — each one is a checkpoint whose failure means the work is not done.

Run them in order. The order matters: the cheap gates catch most mistakes
before the expensive one (running the suites) is reached.

## Gate 1 — Before you write anything

1. **Understand the code you are changing.** Locate the exact function first
   (`grep -n`), then read the surrounding range. Do not read a whole file
   hoping to find the right part, and do not write code against a remembered
   version of the file — the file you remember may be the file that was
   before the last commit.
2. **Find the acceptance criteria.** If the brief does not state them, derive
   them and confirm they are falsifiable before you start (see the
   `requirements-analysis` skill). Work that cannot be checked is not work.
3. **Inspect the related tests, contracts and dependencies.** Know which suite
   covers the code you are about to change, and run it **before** your edit so
   you know it was green. A suite that was already red cannot be used to
   prove your change was good.
4. **Write a plan for anything non-trivial.** Non-trivial means more than one
   file, a new invariant, or a change to a public contract. The plan needs
   the files to touch, the invariant each must hold, and the check that
   proves it.

## Gate 2 — While you implement

1. **Stay in scope.** Only edit what the task requires. If another file must
   change for the change to be correct, say so in your report — do not
   silently widen the change.
2. **Follow the existing conventions**, not the ones you would have chosen.
   In this codebase: 2-space indent, single quotes, semicolons, CommonJS
   `require`, `const`/`let`, and **zero runtime dependencies**. A new
   dependency is itself a finding.
3. **Do not weaken a control.** Never soften a guard, relax a threshold,
   skip a test, or replace a check with a comment. If a control is wrong,
   fix it deliberately and say so — do not make it pass.
4. **Do not accept a conclusion from the caller.** A write path takes raw
   input and validates it. It must never take a caller's word for a verified
   outcome (`met`, `evidence`, `metBy`).
5. **Do not weaken the diff.** No unrelated refactoring, no reformatting, no
   renaming that is not required by the task. A diff that is bigger than the
   task cannot be reviewed, and an unreviewable diff ships defects.
6. **Add or update tests when the change is behavioural.** A new guard with
   no test is an untested guard, and an untested guard is exactly the inert
   guard this office already shipped once.

## Gate 3 — Before you call it done

Run these in order and **actually run them**:

1. **Run the affected suites.** The suites are plain Node scripts:
   `node tools/<suite>.js`. Run the suites that cover the code you changed,
   plus the nearest general gate (`agency_rules_test.js`,
   `project_pipeline_test.js`, `vocabulary_test.js`,
   `sop-consistency-check.js`). A suite that exits non-zero has failed.
2. **Read the output.** "No output" is not a pass; a suite prints
   `N passed, M failed`. Confirm `M` is zero.
3. **Inspect the final diff.** `git diff` / `rtk diff`. Look for: unrelated
   changes, debug leftovers (`console.log`, commented-out code, a stray
   `.only`), a changed file that was never mentioned in the report, and a
   guard that compares a field which does not exist.
4. **Verify the original requirement is satisfied.** Re-read the acceptance
   criteria and check each one against the diff. Not "the feature works" —
   each criterion, individually.
5. **Report the checks you did not run, and why.** A missing check is
   information the reader needs. Silence about it is a false claim.
6. **Never claim verification without evidence.** Quote the real result:
   `node tools/agency_rules_test.js` → `80 passed, 0 failed`. Never write
   "tests pass" when you did not run them, and never report a result you
   did not observe.

## Gate 4 — Risky changes

A change is risky when it touches security, data integrity, backward
compatibility, or deployment. For those:

1. **Evaluate explicitly** and write the evaluation down: what is the blast
   radius, what is the rollback, what data could be lost, what could break
   for an existing caller.
2. **Get explicit approval** before destructive operations, a production
   deployment, a schema/state migration that cannot be reversed, or anything
   that changes what the client receives.
3. **Do not bypass existing permission boundaries.** The office's gates and
   the OpenCode permission system exist to be honoured, not worked around.
4. **Never commit `state/`,** never commit a credential, and never push
   without the owner's explicit go-ahead. A local commit is not a push.
5. **Never write into the git history** something you would not want there —
   a credential that landed in a commit stays in the history.

## Reporting

Report **outcomes, not payloads**: files changed, commands run, checks and
their real results, findings, verdict. Do not paste file contents. State
plainly what you did not verify — that is the most valuable line in the
report.
