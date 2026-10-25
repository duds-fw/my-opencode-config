---
name: backend-api
description: "Add or change a route on the office's hand-rolled node:http API: service boundaries, transactions, concurrency and cross-project isolation."
---

# Extend the office's HTTP API without breaking it

Produces a route that maps a request onto exactly one domain call, keeps the
rules in `agency.js` and `project-pipeline.js`, and stays compatible with
the routes the console already consumes. Use for any work on `server.js`.

For route strings, the response envelope, HTTP statuses per code and
retry-safety per call, load the `api-design` skill. For the codes
themselves, load the `error-handling` skill. This skill owns the service
boundary, the transaction, the concurrency and the isolation rules.

## How routing works here

- `server.js` is a hand-rolled `node:http` server: one
  `http.createServer(async (req, res) => { ... })` whose body is a chain of
  `if` blocks. No Express, no router, no framework.
- A static route: `if (pathname === '/api/agency/state' && req.method === 'GET')`.
  A parameterised route: `pathname.match(/^\/api\/agency\/task\/([^/]+)$/)` —
  see the `taskMatch` and `statusMatch` blocks in `server.js`. CORS headers
  and the `OPTIONS` preflight are set once at the top of the handler; the
  body is read with `readJsonBody(req)`, which caps it at 1 MB and rejects
  invalid JSON.

## The service boundary

- One route = one domain call. The handler parses, calls, and answers. It
  does **not** decide whether the action is allowed.
- Business rules live in `agency.js` (state, orchestration) and
  `project-pipeline.js` (vocabulary, transitions, invariants). A rule copied
  into a handler then exists in two places and drifts. The domain call owns
  the state file: `agency.js` owns `state/agency.json`; `server.js` owns
  `runs.json`, `projects.json`, `usage.json` and `autopilot_session.json`.
  A handler never writes a state file itself.
- The acting role is **not** a request-body field. `agency.js`
  `transitionProject` takes `opts.actingRole`, and its own JSDoc says the
  HTTP layer must authenticate it. `POST /api/agency/approve` still reads
  `body.role` — that is open finding **F-02** in
  `docs/agency-security-review.md`, and `docs/design-api-identity.md` is
  the spec that replaces it. Do not copy that pattern into a new route.

## The six-stage pipeline is not on the HTTP API yet

`server.js` contains **no** reference to `project-pipeline.js` and **no** call
to `transitionProject`, `setAcceptanceCriteria`, `verifyCriterion`,
`projectDetail` or `listProjects`; the pipeline is exercised by
`tools/agency_transition_test.js` and `tools/project_pipeline_test.js`, which
call `agency.js` directly. The only pipeline-adjacent route is
`POST /api/agency/project`, which creates a project at `registered` — nothing
can move it to `triaged` over HTTP today. The exact domain calls "the pipeline
over HTTP" needs, and the `{ ok, reason }` result shape, are in
`references/pipeline-over-http.md`.

## The transaction

- `agency.js` `save()` writes `agency.json.tmp` and renames it over
  `agency.json`, so a reader never sees a partial file. It returns `false`
  when the write failed, and its own doc comment says a caller whose change
  must not be half-applied has to undo it rather than pretend it was stored.
  A route that mutates state must check that result and answer honestly.
- One mutation, one save: the `agency.js` functions call `save()` once,
  after the record is updated, and log the change through `logActivity` or
  `journal.append`.

## Concurrency

- The office is one Node process on one event loop. The domain mutators
  (`createProject`, `setTaskStatus`, `updateTask`, `transitionProject`,
  `verifyCriterion`) are synchronous end to end — they call `load()`, mutate
  the cached object and `save()` without awaiting — so two requests cannot
  interleave *inside* a mutation.
- The await happens **before** the mutation: `await readJsonBody(req)`. Two
  requests can therefore both be in flight, and both will apply, in arrival
  order. There is no request queue, no lock and no version check.
- **There is no idempotency support today** — no idempotency key, no
  request id, no dedupe anywhere in `server.js` or `agency.js`. A retried
  `POST` repeats its effect unless the call is naturally idempotent. The
  `api-design` skill lists which calls are safe to retry and which are not.
- A read must never write: `GET` handlers derive in memory only.
  `agency.metrics()` derives escalation levels without persisting them, and
  `tools/read_path_purity_test.js` proves the read path leaves
  `agency.json` byte-identical.

## Cross-project isolation at the API layer

- A project may never read or write another project's tasks. Resolve the
  project by id, then filter tasks by `task.projectId === project.id`.
- **A project record carries `id`, not `projectId`.** A guard written as
  `project.projectId !== task.projectId` compares `undefined` and passes —
  that guard was inert and let another project's task satisfy a done gate.
- The same rule applies to sprints: a task's sprint must carry the same
  `projectId` as the task (`sprint_project_mismatch`).
- `agency.metrics(projectId)` is project-scoped and defaults to the live
  project; a route that reports on "the" project must pass the id
  explicitly whenever the caller named one.

## Compatibility

- The console in `public/index.html` calls `/api/agency/activity`,
  `/api/agency/capacity`, `/api/agency/vocabulary`,
  `/api/agency/escalation/:id/resolve`, `/api/client/setup`,
  `/api/client/decision/answer`, `/api/opencode/live` and
  `/api/orchestrate/goal`. Those response shapes are a contract: add
  fields, never rename or remove. A new route gets a new path.

## Outputs

The route, the domain call it delegates to, the note on where the acting role
comes from, and the suites run.

## Common mistakes

- Deciding permission in the handler, or taking the role from the body.
- Adding a pipeline rule to `server.js` instead of `project-pipeline.js`.
- Assuming the pipeline is already exposed because `agency.js` exports it.
- Assuming a retry is safe.
- A project-scoped route that filters tasks by the wrong field.