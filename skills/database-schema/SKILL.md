---
name: database-schema
description: "Evolve the office's JSON state records safely: add a field, migrate legacy records on read, and never silently downgrade an unknown value."
---

# Design the office's record schema and migrate it safely

Produces a record shape change that leaves every existing record readable and
every old value recoverable. Use when adding a field to a project, task,
sprint or usage record, or when a record written by an older office has to
keep working.

## What the store actually is

The office has **no SQL database**. Its primary store is JSON files under
`state/`, each with one owning module. The file→owner→contents table is in
`references/state-files.md`.

- There is **no `state/tasks.json` and no `state/sprints.json`** — tasks and
  sprints live inside `agency.json`. Grep before you assume a file has an
  owner: `state/delegations.json` still exists on disk while no module
  writes it any more.
- `state/` is gitignored and must never be committed. The one SQL statement
  in the office is a read-only query against caveman's own `ccr.db` in
  `token-savings.js` — that is the tool's store, not the office's.
- `state/client.json` is mode `0600` and holds the owner bot token: never read
  it into a report, a log or a commit. Read the file's existence, never its
  contents.

## Adding a field to a record

1. Add it to the constructor, with an explicit default — `createProject` in
   `agency.js`, `createTask` in `agency.js`, `createSprint`.
2. Add the same default to the migration for that record type, so a record
   written by an older office gets the field on load.
3. Read it defensively (`record.field ?? default`) — records written before
   the change exist until the next save rewrites them.
4. Never repurpose an existing field for a new meaning. Add a new field
   name and migrate; one field with two meanings breaks every old reader.
5. A new field must not change an invariant quietly. If it can, the
   invariant's guard is what has to change too, and it is named in the
   acceptance criteria.

## Migrating legacy records on read

- The pattern is already in place: migrate **once, at the boundary**, so
  every consumer afterwards sees a valid model. `agency.js` `load()` calls
  `migrateLegacyState(db)`, which calls `pipeline.migrateProject(project)`
  and `pipeline.migrateTask(task)` from `project-pipeline.js` and logs the
  notes it produced.
- A migration returns `{ changed, notes }`. Log what it repaired — the
  existing call prints the notes and saves the file.
- A migration runs on **every load**, so it must be idempotent: running it
  twice changes nothing the second time.
- `server.js` `migrateAutonomyUsage` is the model of a non-destructive
  migration: when the counters were split it carried the old total into
  `legacyStepsToday` instead of discarding it.

## Never silently downgrade an unrecognised value

- The rule: a migration must not replace a value it does not recognise with
  a default, and must not lose the original.
- The current state of the code: `pipeline.migrateProject` sets an
  unrecognised `status` to `registered` and **discards the original
  value**. That is the defect this rule exists to stop, and it is still in
  the source — the notes text is `unknown status <x> -> registered`.
- A fix keeps the value and makes the record visible rather than plausible:
  either leave `status` as it is (the stage machine then refuses the move
  with `illegal_project_transition`, because `canTransition` rejects an
  unknown source status), or normalise the status **and** keep the
  original in a sibling field so nothing is lost. Whichever you choose, add
  a check that an unknown status survives a load.

## Keeping old and new records coexisting

- Writers always write the full shape; readers tolerate a missing field.
  That is the only way a JSON store can hold two generations of a record.
- Add, migrate, then remove: add the new field, migrate on load, and only
  drop the old reader once every record has been rewritten.
- A record that cannot be understood must remain loadable and visible. It
  must never be made to look like a valid record it is not.

## Making a migration reversible

- Prefer an additive migration (add a field, keep the old): it is reversible
  by ignoring the new field. A migration that rewrites a value keeps the
  old value (above) and has a stated inverse.
- Every migration ships with a test: seed a legacy-shaped record, load it,
  assert both the new shape and the preserved value. The office's suites
  run against an isolated state directory — set `AGENCY_STATE_DIR` before
  requiring `agency.js` — and `tools/agency_transition_test.js` is where
  the pipeline record cases live.
- `state/activity.jsonl` and the migration notes are the audit trail of what
  was repaired; they are append-only, so a migration that needs to be
  explained later can be.

## Durability differs between the state files

- `agency.js` `save()` writes `agency.json.tmp` and renames it over the
  target: atomic, and a reader never sees a half-written file.
- `server.js` `saveRuns`, `saveProjects` and `saveUsage`, and
  `work-queue.js`'s queue write, call `fs.writeFileSync` directly: not
  atomic. A crash mid-write can truncate the file. When you add a state
  file, follow the `agency.js` pattern.

## Outputs

The changed constructor, the migration and its notes, the test that proves
the old records still load, and the file(s) whose shape changed.

## Common mistakes

- Assuming a relational schema and writing SQL against tables that do not
  exist.
- Adding a field to a constructor but not to the migration, so old records
  keep the old shape forever.
- Replacing an unrecognised status with `registered` and losing the
  original value.
- Editing `state/agency.json` by hand to "fix" a record while the service
  runs — the server owns it in memory and overwrites the edit.
