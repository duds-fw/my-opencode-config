---
name: ci-cd
description: "Build or validate a CI pipeline for the Virtual Office: the real test-suite gate, runner and Node pinning, failure semantics, and the human gate that keeps a pipeline from deploying."
---

# CI/CD for the Virtual Office

There is **no CI pipeline in this repository today** — no `.github/workflows`,
no `Makefile`, no CI service. The office is deployed by systemd. This skill
is about building one correctly, or about validating one someone else built.

## What the pipeline must run

The project has **zero runtime dependencies**, so a pipeline installs nothing
and caches nothing. The entire gate is the plain-Node test suites:

```
node tools/project_pipeline_test.js
node tools/agency_rules_test.js
node tools/agency_transition_test.js
node tools/vocabulary_test.js
node tools/sop-consistency-check.js
node tools/activity_journal_test.js
node tools/autonomy_budget_test.js
node tools/briefing_test.js
node tools/budget_report_test.js
node tools/model_router_test.js
node tools/provider_availability_test.js
node tools/provider_verdict_test.js
node tools/read_path_purity_test.js
```

`tools/sop-consistency-check.js` is not optional. It checks that
`docs/role-guidelines.md` still matches the `ROSTER` in `agency.js` — a
documentation/mechanism drift that no unit test catches.

Run them with a loop, not thirteen copy-pasted steps:

```bash
for t in tools/*_test.js tools/sop-consistency-check.js; do
  node "$t" || exit 1
done
```

**Check the exit code, not the output.** A suite that prints
`N passed, M failed` but still exits `0` gives the pipeline nothing to act
on. If a suite swallows its failure, fix the suite before you wire it into a
gate — a green pipeline over a failing suite is worse than no pipeline.

## The rules that make a pipeline correct

1. **Run the gate on every change.** A pipeline that runs only on `main` has
   already shipped the defect it was meant to catch.
2. **Fail the build on a non-zero exit.** Never `|| true`, never
   `continue-on-error: true` on a suite.
3. **Pin the runner and the Node version.** This machine runs Node
   `v20.18.0`. Pin the same major in CI; an unpinned `node` makes the build
   non-reproducible and turns a real regression into "works on my machine".
4. **Install nothing.** There is no `package.json`. A pipeline step that runs
   `npm install` is a bug — it either fails or it invents a dependency.
5. **Keep the pipeline's own token cost low.** A pipeline that re-reads the
   whole repository, or that runs an LLM on every commit, spends the
   organization's budget to test code it can test for free. Run the suites,
   not the model.
6. **No deployment from CI.** There is no deploy target in CI. The office is
   a systemd unit (`virtual-office.service`, `ExecStart=node server.js`).
   Restarting it is a human action requiring the owner's go-ahead, and a
   pipeline must never push, tag or release.

## Before you trust a pipeline you did not write

1. **Run it locally first.** The suite list above, in order, from
   `/home/opencode/virtual-office`.
2. **Break something on purpose** — invert one assertion in a scratch copy —
   and confirm the pipeline goes red. A pipeline that has only ever been
   green is not a tested pipeline.
3. **Confirm it fails on the right reason.** A pipeline that fails because
   the runner is misconfigured tells you nothing about your code.
4. **Check the gate is complete.** If a suite is missing from the pipeline,
   that defect class is now unguarded.

## Outputs

Report the pipeline file path, the exact suite list it runs, the Node version
it pins, the failure semantics you verified (including the deliberate-red
test), and every check you did not run.

## Common mistakes

- Installing dependencies that do not exist.
- Treating a printed `0 failed` as a pass without checking the exit code.
- Omitting `sop-consistency-check.js` because it "is not a unit test".
- Letting CI deploy or push.
- Running the office's own autonomy tick inside CI — it writes `state/`.
