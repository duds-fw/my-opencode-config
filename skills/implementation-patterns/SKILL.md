---
name: implementation-patterns
description: "Write production code in the Virtual Office: smallest complete change, zero dependencies, CommonJS style, and safe JSON state writes."
---

# Write production code in the Virtual Office

Produces the smallest complete change to the office's dependency-free Node
codebase that satisfies the acceptance criteria it was given, and nothing
else. Use for any task that edits `agency.js`, `project-pipeline.js`,
`server.js` or another office module.

## The stack, exactly

- Node v20, CommonJS `require`. There is **no `package.json`** and **no
  `node_modules`** in `/home/opencode/virtual-office` — never `npm install`,
  never add a dependency, never add a build step. `node tools/<suite>.js`
  runs a suite directly.
- 2-space indent, single quotes, semicolons, `const`/`let`. The whole
  codebase contains zero occurrences of `var`.
- Only `node:` builtins (`fs`, `path`, `http`, `crypto`, `child_process`)
  plus the office's own modules.
- The service is `virtual-office.service`; restart it with
  `systemctl restart virtual-office.service`, never
  `opencode service restart` from inside a session the server hosts.

## The smallest complete change

1. Read the acceptance criteria and name the files that must change. If a
   criterion needs no code, change nothing.
2. Change only what the criteria require. A drive-by refactor, a renamed
   helper or a "while I was here" cleanup is **not** part of the change and
   makes the diff unreviewable. Unrelated cleanup is a separate task.
3. Put the rule where it belongs: stage vocabulary and invariants in
   `project-pipeline.js` (pure, no I/O), state and orchestration in
   `agency.js`, HTTP shape in `server.js`. Never copy a rule into a second
   layer — two copies drift.
4. Validate before mutating: a rejected input must leave the record
   untouched. `agency.js` `updateTask` validates estimate, project, sprint,
   phase, role and deliverable, and only then mutates.
5. Save once, at the end of the mutation. `agency.js` `save()` returns
   `false` when the write failed; a caller whose change must not be
   half-applied undoes it instead of pretending it was stored.

## Style as used in `agency.js`

- `camelCase` functions, `UPPER_SNAKE` constants, one `module.exports`
  block at the bottom of the file.
- A domain function returns `{ ok: true, ... }` or
  `{ ok: false, reason: '<stable_code>' }`. `reason` is a code a caller
  branches on; `errors` (when present) carries the human sentence.
- Block comments earn their place only when they say **why** — the note
  above `save()` about a failed write, or the note in `project-pipeline.js`
  `checkDoneGates` that a project record carries `id`, not `projectId`.
  Do not restate the code.
- Only the surface the office calls is exported; helpers stay private.

## Reading and writing `state/`

- `state/` is **gitignored** and must never be committed. It holds
  `agency.json`, `projects.json`, `runs.json`, `usage.json`,
  `autopilot_session.json`, `work-queue.json`, `activity.jsonl` and
  `client.json`. `state/client.json` holds the owner bot token — never read
  it into a report, a log or a commit.
- The server holds the office state **in memory** and rewrites it on every
  tick. While `virtual-office.service` runs, never hand-edit a file in
  `state/` — the server overwrites the edit. Change the code that owns the
  write.
- Each file has one owner: `agency.js` owns `state/agency.json` (projects,
  sprints, tasks, escalations, decisions, standups, activity); `server.js`
  owns `runs.json`, `projects.json`, `usage.json` and
  `autopilot_session.json`; `work-queue.js` owns `work-queue.json`;
  `activity-journal.js` owns the append-only `activity.jsonl`; `client.js`
  owns `client.json`. Write only through the owner.
- Mutate the object you got from `load()`, `taskById()` or the record in
  its array, then call `save()` once. Never write the JSON file yourself.
  `save()` writes `agency.json.tmp` and renames it over the target, so a
  reader never sees a half-written file.
- A read must never write: `tools/read_path_purity_test.js` proves the read
  path leaves `agency.json` byte-identical.
- To exercise a write path without touching live state, set
  `AGENCY_STATE_DIR` **before** requiring `agency.js` — that is what every
  suite in `tools/` does.
- To change the shape of a record, edit the constructor and the migration in
  the owning module, not the file. See the `database-schema` skill.

## House test style

A suite is a plain Node script in `tools/`: a `check(label, cond, detail)`
helper, one `console.log('--- section ---')` per group, and a final
`console.log(`${pass} passed, ${fail} failed`)` with
`process.exit(fail === 0 ? 0 : 1)`. Model it on
`tools/agency_rules_test.js`.

## Before you report

- Run every affected suite and quote its `N passed, M failed` line. For
  test *design*, load the `testing-strategy` skill.
- `git status` shows only your files; `state/` is absent.
- Commit locally (`git commit`) — a task may not leave `in_progress`
  uncommitted, and a `kind: code` deliverable carries that SHA in
  `deliverable.ref`. Never push.
- Report outcomes: files changed, suites run, decisions made. No file
  contents.

## Outputs

The changed files, the suites run with their pass/fail lines, and the commit
SHA.

## Common mistakes

- Adding a dependency or a `package.json` to "modernise" the code.
- Hand-editing `state/agency.json` while the service runs.
- Moving a rule out of `project-pipeline.js` for readability — that module
  is deliberately free of I/O so the stage machine can be tested without a
  server.
- Refactoring a neighbouring function "because it was ugly".
- Calling `save()` on a read path.
