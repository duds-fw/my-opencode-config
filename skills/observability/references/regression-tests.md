# Performance regression tests in this repo's harness

The harness is a plain Node script in `tools/`, run with `node tools/<name>.js`.
There is no framework: a `check(label, cond, detail)` helper prints
`  PASS  <label>` / `  FAIL  <label> :: <detail>`, the script ends with
`N passed, M failed` and exits 1 on failure. Copy `tools/activity_journal_test.js`.

Isolate state before requiring anything: `process.env.AGENCY_STATE_DIR =
'/tmp/<name>'` — `agency.js` and `activity-journal.js` both read it.

**Bound the work, not the clock.** Assert on a count, a size or a step budget.

- *A tick's step count stays within its budget.* Drive `claimAutonomyStep` past
  its cap and assert `usage.stepsToday <= cfg.maxStepsPerDay` and that the
  refusal names the limit — `tools/autonomy_budget_test.js` already does this.
- *A state write does not grow the file without bound.* Call the mutating path
  M times and assert the byte size of `state/agency.json` after the last write
  stays within a stated bound of the size after the first: the whole file is
  rewritten each time, so a record that grows per write is a real leak.
- *The journal grows by exactly one line per event.* Assert the line count of
  `state/activity.jsonl` rose by exactly the number of `journal.append` calls.

If a time must be asserted, take the median of at least five runs, compare
against a generous multiplier, and say in the test comment where it came from.

A regression test that asserts a millisecond threshold fails on someone else's
box and passes on the bug.
