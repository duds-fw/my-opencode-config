# The office HTTP API surface

Verified against `server.js` (flat `if (pathname === ... && req.method === ...)`
dispatch plus a few regex-matched paths). The API is the source of truth for
state: the server holds `state/` in memory and rewrites it, so **read and
write through the API, never by editing the JSON files directly.**

## Read routes (GET)

| Route | Returns |
|---|---|
| `/api/agency/state` | board, tasks, roster, metrics, standup |
| `/api/agency/workload` | capacity and utilisation per role |
| `/api/agency/capacity` | role capacity detail |
| `/api/agency/metrics` | velocity, SLA, lead time, utilisation |
| `/api/agency/tokens` | token accounting |
| `/api/agency/activity` | activity journal |
| `/api/agency/savings` | what rtk + caveman have saved |
| `/api/agency/lessons` | what the last retrospective changed (also POST) |
| `/api/agency/models` | model routing state and queued work |
| `/api/agency/health` | provider health, stuck subagents |
| `/api/agency/decisions` | decision log |
| `/api/agency/standup` | standup records (also POST) |
| `/api/agency/vocabulary` | shared vocabulary |
| `/api/client/status` | owner channel status |
| `/api/opencode/live` | live OpenCode session view |
| `/api/orchestrate/runs` | orchestration run history |
| `/api/autonomy/status` | autonomy loop status |

## Write routes (POST / PATCH / DELETE)

| Route | Purpose |
|---|---|
| `POST /api/agency/project` | **the only project route that is wired** |
| `POST /api/agency/task` | create a task |
| `POST /api/agency/task/:id/status` | transition a task |
| `PATCH /api/agency/task/:id` | edit a task |
| `DELETE /api/agency/task/:id` | cancel a task |
| `POST /api/agency/escalation/:id/resolve` | resolve an escalation |
| `POST /api/agency/advance` | advance a project |
| `POST /api/agency/approve` | approve something |
| `POST /api/agency/assign` | assign work |
| `POST /api/agency/sprint` | create a sprint |
| `POST /api/agency/models/probe` | probe a provider |
| `POST /api/agency/models/simulate-exhausted` | simulate exhaustion |
| `POST /api/autonomy/start` `/stop` `/tick` `/budget` | autonomy loop control |
| `POST /api/client/decision` | raise a strategic decision for the owner |
| `POST /api/client/decision/answer` | record the owner's answer |
| `POST /api/client/report` | send the owner a report |
| `POST /api/client/setup` | owner channel setup |
| `POST /api/orchestrate/goal` | start an orchestrated goal |

## The pipeline is not fully reachable

`server.js` registers **no** project-stage route beyond
`POST /api/agency/project`. The stage endpoints specified in
`docs/design-project-pipeline.md` §5 — triage, criteria, verification,
acceptance — are **specified but not wired**. `server.js` has no reference to
`project-pipeline.js` at all.

Do not design against, call, or document an endpoint that does not exist. If
a task needs the pipeline exposed over HTTP, that is real work: add the
route, delegate to `project-pipeline.js`, and cover it with a test.

## Rules for callers

- **Never send a conclusion.** A request body carries raw input. It must not
  carry `met`, `evidence`, `metBy`, or a role that decides authorization —
  those are computed server-side.
- **Validate at the edge.** Raw input is validated in the route handler and
  only validated data is passed inward.
- **State-mutating routes must be safe to repeat.** Decide deliberately
  whether a route is idempotent, and make it so.
- **Errors use the office's stable codes**, never free text.
