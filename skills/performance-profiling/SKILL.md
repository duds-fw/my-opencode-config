---
name: performance-profiling
description: "Establish a measured baseline and locate the real bottleneck in the Virtual Office before changing code, budgets or the autonomy tick loop."
---

# Profile the Virtual Office's real costs before changing them

The office is billed per token, not per millisecond. This procedure produces a
baseline, a named bottleneck with evidence behind it, and a measurement showing
whether the change helped.

## A performance claim needs a measurement

"It feels slow" is not a finding. A claim is admissible only when it carries the
number, the command that produced it, and the baseline it was compared against.
Without all three you have a hypothesis. Rank the office's costs first:

1. **LLM tokens per task and per session.** The real bill; the rest is noise.
2. **Context size of a delegation.** A growing prefix is re-read every turn;
   see `TOKEN_SPIKE_INCIDENT.md`.
3. **Wall-clock of an autonomy tick.** Throughput, and the `maxTicksPerHour` cap.
4. **Node CPU milliseconds.** Only worth measuring once 1–3 are accounted for.

## Measure with the machinery that already exists

Check these before writing a collector. A new collector that duplicates one of
them is a second source of truth. The existing collectors — `token-savings.js`
`collect({ spentTokens })`, `token-compliance.js` `collect({ tokens })`,
`GET /api/agency/tokens`, `fetchTokenUsage()` in `server.js`,
`agency.metrics(projectId)`, `recordAutonomyRefusal(usage, reason, consumer,
limit)` and the `session-guard` plugin — and what each one returns are in
`references/measurement-tools.md`.

## Measure the three costs that bind

**Tokens per task and per session.** Take the session ids the office spawned
from `state/usage.json` and the per-session totals from `fetchTokenUsage()`;
divide by the tasks that session's delegation closed. The unit that matters is
tokens per completed task, not per session.

**Context size of a delegation.** `session-guard` already computes it: the
newest assistant message's `tokens.input + tokens.cache.read`. Sum both — a
cache miss puts the bulk in `input`, a cache hit in `cache.read`, so reading
only one misses half the cases. Never estimate from character counts.

**Wall-clock of an autonomy tick.** Nothing measures this today:
`autonomyUsage.lastTickAt` is a timestamp, not a duration. Wrap the call —
`const t0 = process.hrtime.bigint()` before `runAutonomyTick()`, and
`(process.hrtime.bigint() - t0) / 1e6` after — and record the duration on the
tick's journal entry. This is the cheapest useful instrumentation in the office.

## Node-level tools, and when each is worth using

- `process.hrtime.bigint()` — nanosecond, monotonic. The default for one span.
- `performance.now()` — millisecond float; use `performance.mark()` /
  `performance.measure()` for named spans across modules.
- `node --cpu-prof` — V8 CPU profile to a `.cpuprofile`. Use only after a span
  is proven hot and unexplained: `agency.save()` runs
  `JSON.stringify(db, null, 2)` over the whole of `state/agency.json` and is
  called from 26 sites in `agency.js`.
- `node --prof` — V8 tick profiler, heavier log. Use when `--cpu-prof` did not
  explain the span.

The office has zero runtime dependencies: do not add a profiler library, and do
not profile the running service in production — `node --cpu-prof` writes a
profile into the working directory.

## Find the bottleneck before you optimise

Baseline → hypothesis → one change → re-measure → keep or revert. One change at
a time, or the re-measurement tells you nothing.

Known hot paths, in likelihood order: the full-file JSON rewrite in
`agency.save()`; `JSON.stringify` of a whole board on every `agency.state()`
call; and the per-tick prompt assembly in `server.js`.

## No speculative caching

The office re-reads and re-writes JSON state files, and it already has **two**
sources of truth for projects: `state/projects.json` (server.js) and
`state/agency.json` (agency.js). That is a known problem, not a pattern to
extend. A cache is allowed only when all three hold:

1. You have a baseline number showing what the uncached path costs.
2. You can name the exact event that invalidates the cached value.
3. The cached value is derived and is never written back to disk independently.

The precedent is `liveCache` in `server.js`: a 4-second TTL cache in front of
`fetchLiveData()`, and nothing more.

## Revert what cannot be shown to help

Run the measurement at least three times and compare medians. A change smaller
than the run-to-run spread is noise, not a win. If the re-measurement shows no
win, revert it — "it is faster" is not evidence, and an unmeasured optimisation
is a second implementation of the same idea. Put the baseline, the command and
the after-number in the deliverable. If a check could not be run, say which one
and why.

## Outputs

- A baseline: the metric, the command that produced it, the environment.
- A named bottleneck and the measurement that identified it.
- The after-number for the change, or an explicit statement that it was
  reverted.

## Common mistakes

- Reporting a token saving with no `spentTokens` baseline — `token-savings.js`
  needs it to compute `percentOfSpend`; without it the percentage is
  meaningless.
- Measuring `cache.read` alone and concluding the context is small.
- Adding a cache to `agency.js` state without an invalidation rule.
- Quoting a live file size as a fact — measure with `rtk wc state/agency.json`
  at the moment you need it — and optimising Node CPU while tokens per task
  are unbounded.
