# The state files and who owns them

The office's primary store is JSON files under `state/`, each with one owning
module.

| file | owner | holds |
|---|---|---|
| `agency.json` | `agency.js` (`FILE`) | projects, sprints, tasks, escalations, decisions, standups, activity |
| `projects.json` | `server.js` (`PROJECTS_FILE`) | orchestrate goals — a *different* projects list from the one in `agency.json` |
| `runs.json`, `usage.json`, `autopilot_session.json` | `server.js` | goal runs, autonomy counters, autopilot session |
| `work-queue.json` | `work-queue.js` | the queue |
| `activity.jsonl` | `activity-journal.js` | append-only JSONL journal, one line per change |
| `client.json` | `client.js` (mode `0600`) | the owner bot token — never read it into a report, a log or a commit |

## Two sources of truth for projects

`server.js`'s `state/projects.json` and `agency.js`'s `state/agency.json` both
hold a projects list. They are not the same list. A change that adds a project
field must decide which one it belongs to, and must not silently let the two
drift.

## Files that exist without an owner

`state/delegations.json` still exists on disk while no module writes it any
more. Grep before assuming a file has an owner.

## Durability differs between the state files

`agency.js` `save()` is atomic (tmp file + rename); `server.js` `saveRuns`,
`saveProjects`, `saveUsage` and the `work-queue.js` queue write call
`fs.writeFileSync` directly and are not. Full detail is in SKILL.md.

## The one SQL statement in the office

`token-savings.js` reads caveman's own `ccr.db` with a read-only query. That
is the tool's store, not the office's.
