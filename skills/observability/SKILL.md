---
name: observability
description: "Add structured logging, request correlation and performance regression tests to the Virtual Office by extending its existing journal and token machinery."
---

# Instrument the Virtual Office by extending what it already records

The office already has an append-only journal, two token collectors and a
context guard. This procedure adds structured events, one correlation id across
the HTTP edge and the state write, and a regression test in the plain-Node
harness — without creating a parallel logging system.

## Extend the machinery that already exists

- `activity-journal.js` → `append(type, payload)`, `read()`, `tail(n)`, `EVENT`.
  Writes `state/activity.jsonl`, one JSON object per line, `{ at, type, ...payload }`.
  `append()` swallows write errors, so the journal can never take the office down.
  Served by `GET /api/agency/activity`; `agency.js` writes 7 events, `server.js` 5.
- `token-savings.js` → `collect({ spentTokens })`, `parseRtkGain(text)`,
  `compact(n)`; wired into `server.js` and served by `GET /api/agency/savings`.
  `token-compliance.js` → `collect({ tokens })`, `parseRtkGain(text)`; it is
  **not** required by `server.js`, so wire it in before quoting its output.
- `session-guard` plugin (`~/.config/opencode/plugins/session-guard.ts`) →
  writes plain text lines to `/tmp/opencode/session-guard.log`.

A new event type goes into `EVENT` and a new metric into an existing collector;
a second log file or token counter is a parallel system.

## What a structured line carries

Keep the journal's envelope and add the fields that make a line countable:

    { at, type, subject, action, outcome, durationMs, ...domainIds }

- `subject` — the id the line is about (`projectId`, `taskId`, `sessionID`,
  `runID`), never a name.
- `action` — what was attempted, as a stable slug: `assign_task`, `approve_gate`.
- `outcome` — one of `ok`, `refused`, `error`. Three values, always these.
- `durationMs` — only when the span was timed; omit it otherwise, never `0`.
- domain ids — `taskId`, `gate`, `role`, `modelKey`, `reason`, `limit`.

Keep the line cheap enough to always emit: no `JSON.stringify` of a board, no
read of a state file inside the log call, no rendering of a prompt. One line per
event, appended with `journal.append`. The existing `console.log('[autonomy] tick
skipped: …')` calls are prose — keep `console.log` for human notices and put
anything you must count in the journal.

## Correlating a request across HTTP, mechanism and state write

There is no tracing infrastructure and zero runtime dependencies, so do not add
one. `crypto` is already required at `server.js:5`. Correlate with one id.

1. **HTTP edge.** The server is one handler,
   `http.createServer(async (req, res) => {…})` in `server.js`, with an
   `if (pathname === …)` chain. Mint the id at the top of the handler, before
   the first route check: `const requestId = crypto.randomBytes(6).toString('hex')`.
2. **Mechanism.** Pass `requestId` into the `agency.*` call. `agency.js` already
   appends `journal.EVENT.TASK_STATUS` with `{ who, text, taskId, status }` in
   `setTaskStatus` — add `requestId` to that payload and to the other six
   journal append sites. The id is metadata, not a verdict: never let it reach
   an acceptance guard, nor become a second write path.
3. **State write, then read it back.** `agency.save()` is the write, and it
   follows the journal append in each mutating function. Time it with
   `process.hrtime.bigint()` around the `fs.writeFileSync` + `fs.renameSync`
   pair and record `durationMs` on the same journal line. Then
   `grep '"requestId":"<id>"' state/activity.jsonl` returns all three, in order.

## What a line must never carry

- **Never the owner bot token.** `state/client.json` is mode 0600 and holds it;
  it must not enter a log line, journal entry, report, fixture or commit. Read
  the file's *existence*, never its contents.
- **Never a raw personal datum.** No owner-channel message text, names, email
  addresses, credentials or raw prompt bodies — record ids, counts, roles.
- **Never rendered markup or a whole object.** `journal.append` stores
  caller-supplied text as inert data, and `journal.append(EVENT.X, db)` copies
  the entire board into the journal on every event.

## Greppable and countable, not prose

Every line of one type must carry the same field names, so a count is one line:

    jq -r 'select(.type=="task.status") | .outcome' state/activity.jsonl | sort | uniq -c
    grep -c '"outcome":"refused"' state/activity.jsonl

If a count needs a regex over a prose sentence, the line is wrong. If one
outcome can be spelled two ways, the slug set has drifted — fix it.

## Performance regression tests in this repo's harness

The harness is a plain Node script in `tools/`, run with `node tools/<name>.js`.
There is no framework: a `check(label, cond, detail)` helper prints
`  PASS  <label>` / `  FAIL  <label> :: <detail>`, the script ends with
`N passed, M failed` and exits 1 on failure. Copy `tools/activity_journal_test.js`.

Isolate state before requiring anything: `process.env.AGENCY_STATE_DIR =
'/tmp/<name>'` — `agency.js` and `activity-journal.js` both read it.

**Bound the work, not the clock.** Assert on a count, a size or a step budget —
never on a millisecond threshold. The three worked budget assertions, and what
to do when a time must be asserted, are in `references/regression-tests.md`.

## Outputs

- The event types added to `activity-journal.js`, and where each is written.
- The correlation id scheme, the grep that reads one request back, and the
  regression test file under `tools/` with the command that runs it.

## Common mistakes

- Adding a log file instead of a journal event, so two histories disagree.
- Logging the whole board, or a prompt body, into the journal.
- Writing `durationMs: 0` for a span that was never timed.
- Quoting `token-compliance.js` output before it is wired into `server.js`.
- A regression test that asserts a millisecond threshold: it fails on someone
  else's box and passes on the bug.
