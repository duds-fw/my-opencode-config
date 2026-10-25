# Harness template

Copy this skeleton into `tools/<subject>_test.js`. It matches the office house
style: plain CommonJS, no framework, no build step, no runtime dependency.

```js
'use strict';
/**
 * <subject>_test.js — <what this suite proves>.
 *
 *   1. <first thing proved>
 *   2. <second thing proved>
 *
 * Runs against an isolated state directory so it never touches live office data.
 *   AGENCY_STATE_DIR=/tmp/<subject>-test node tools/<subject>_test.js
 */
const fs = require('fs');
const path = require('path');

// The isolated state dir, wired through the same AGENCY_STATE_DIR mechanism
// agency.js reads at load time. The live office state lives in <repo>/state —
// never point the harness at it, whatever the environment says.
const ISOLATED_STATE = '/tmp/<subject>-test';
const LIVE_STATE = path.resolve(__dirname, '..', 'state');
const requested = process.env.AGENCY_STATE_DIR || ISOLATED_STATE;
const resolved = path.resolve(requested);
const STATE = resolved === LIVE_STATE || resolved.startsWith(LIVE_STATE + path.sep)
  ? ISOLATED_STATE
  : requested;
fs.rmSync(STATE, { recursive: true, force: true });
fs.mkdirSync(STATE, { recursive: true });
process.env.AGENCY_STATE_DIR = STATE;

// Set AGENCY_ESCALATION_MS here, before the require, if a case observes the
// escalation ladder. Production default is 24h per level; the derived level
// is computed in memory on read.
// process.env.AGENCY_ESCALATION_MS = '1000';

const agency = require(path.join(__dirname, '..', 'agency.js'));
const pipeline = require(path.join(__dirname, '..', 'project-pipeline.js'));

let pass = 0;
let fail = 0;
let skip = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`); }
}
function skipped(label, why) { skip++; console.log(`  SKIP  ${label} :: ${why}`); }

/** A broken precondition is a broken suite, not a failed invariant. */
function must(cond, message) {
  if (!cond) throw new Error(`setup failed: ${message}`);
}

const PO = 'product_owner_product_manager';
const SE = 'software_engineer';

// ------------------------------------------------------------- first section
console.log('--- <section name> ---');
{
  const result = agency.createProject({ name: 'Fixture', goal: 'Prove it', budgetHours: 20 });
  check('<behaviour in plain words>', result.ok === true, JSON.stringify(result));
}

// ------------------------------------------------------------------- report
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
```

## Notes

- `check(label, cond, detail)`: `label` says what was proven in plain words,
  `cond` is the assertion, `detail` prints only on failure. Put the offending
  value there: `JSON.stringify(result)`.
- The counter is per-suite. A suite never requires another suite.
- `must()` throws instead of counting a failure, so a broken fixture cannot be
  mistaken for a broken invariant.
- `skipped()` is for a check that could not run (no browser, no server). Report
  skips; do not count them as passes.
- If the suite asserts on a refusal, assert on the stable `reason` code, never
  on the `errors` prose.
- Suites are run as `node tools/<subject>_test.js`. There is no `npm test`.

## Existing suites to copy from

- `tools/project_pipeline_test.js` — pure-function checks against `pipeline.*`
  plus runtime checks against `agency.*`.
- `tools/agency_rules_test.js` — gates, escalation ladder, resource and token
  budgets; shows the async `sleep` pattern for time-derived behaviour.
- `tools/agency_transition_test.js` — one labelled group per invariant P1-P9,
  with `must()` setup guards and a `rec()` helper that tolerates a wrapped
  return shape.
- `tools/vocabulary_test.js` — the `skipped()` helper in use.
- `tools/read_path_purity_test.js` — asserts a read leaves the state file
  byte-identical.
