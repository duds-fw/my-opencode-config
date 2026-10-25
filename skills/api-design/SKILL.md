---
name: api-design
description: "Design or change an office HTTP route: route shape, the error envelope and the nine pipeline codes, idempotency, and backward compatibility for existing callers."
---

# Design and change the office's HTTP API

Produce a route that is a thin shell over `agency.js`, answers with the office's
error vocabulary, and can be retried without creating a second record.

This skill is the **design discipline** for a route. For how this codebase
routes and bounds transactions, load `backend-api`.

## 1. Verify the route strings before you write them

`server.js` registers routes two ways: a fixed path with
`pathname === '/api/agency/project' && req.method === 'POST'`, and a
parameterised path with
`pathname.match(/^\/api\/agency\/task\/([^/]+)\/status$/)`. So the shape is
`POST /api/agency/<resource>/:id/<action>` — e.g. `POST
/api/agency/task/:id/status` exists today.

**Grep `server.js` before asserting any route string**: the design doc lists a
project route family (`docs/design-project-pipeline.md` §5:
`/api/agency/project/:id/triage`, `/plan`, `/deliver`, `/verify`, `/accept`,
`/ratify`, `/cancel`) that is **specified but not yet wired**. Only
`POST /api/agency/project` (create) is live today, while `agency.js` already
exports `transitionProject`, `setAcceptanceCriteria`, `verifyCriterion`,
`projectDetail` and `listProjects` for the unwired routes.

## 2. One envelope, one vocabulary

The office already has two shapes. Do not add a third.

| Shape | Where | Example |
|---|---|---|
| agency verdict, passed through verbatim | most `/api/agency/*` routes | `{ ok: false, reason: 'illegal_project_transition', errors: [...] }` |
| §5 envelope with a code/message pair | `/api/agency/escalation/:id/resolve` | `{ ok: false, error: { code, message } }` |

`agency.js` returns `{ ok, reason, errors }`, and the pipeline's `reason` is
always one of the office's stable codes — the full list, and the HTTP status
for each, is in `references/status-mapping.md`. **Pass the code through
unchanged.** Never translate `acceptance_not_met` into "not all criteria
passed" — a caller must be able to branch on the code, and a free-text error is
not a contract. `agency.js` also returns `criterion_frozen` when a verified
criterion is re-pointed, and `missing_deliverable_ref` when a code deliverable
carries no commit SHA — keep both.

Recommended status mapping (the office uses 200/400/404/409/500 today): see
`references/status-mapping.md` for the code-to-status table and what the
404/400/409/403 split means to a caller.

## 3. Validate at the route boundary

- Parse the body with `readJsonBody(req)`; it caps the body at 1 MB and rejects
  invalid JSON. A malformed body answers 400 `{ ok: false, error: 'Invalid JSON body' }`.
- **Never take the acting role from the body.** `transitionProject` takes
  `opts.actingRole`, and `agency.js` is explicit that the HTTP layer
  authenticates it, not the request.
- Refuse an unknown value instead of storing it: an unrecognised task status
  (`invalid_status`), an unrecognised role (`invalid_role`), an unknown sprint
  (`unknown_sprint`), a sprint from another project (`sprint_project_mismatch`).
- Do not re-implement a pipeline rule in the route. `canTransition` decides; the
  route calls it and reports its verdict.
- A GET must not write (F-17, `tools/read_path_purity_test.js`).

For validation beyond the route boundary, and for the service-boundary and
concurrency mechanics of a new route, load the **error-handling** and
**backend-api** skills.

## 4. Make it safe to retry

| Call | Retry behaviour | Rule |
|---|---|---|
| `createProject` | **not idempotent** — a new random id each call, so a retry creates a second project | accept a caller-supplied key or de-duplicate before writing |
| `setAcceptanceCriteria` | idempotent — it replaces the whole checklist | safe to retry |
| `transitionProject` | **not idempotent** — the retry hits `illegal_project_transition` | if the project is already in the target stage, answer 200 with the project; answer 409 only when the move is genuinely illegal |
| `verifyCriterion` | safe — re-verifying a met criterion returns `criterion_frozen` and changes nothing | keep it that way |
| `resolveEscalation` | safe — the retry returns `already_resolved` | keep it that way |

State the retry behaviour of a new route in the plan. "The client will retry on
a 5xx" is the default expectation of any HTTP client.

## 5. Keep existing callers working

- **Additive only.** Add fields, routes and checks. Do not change what an
  existing field means — the design doc's §4 data model is explicitly additive.
- Keep the derived `active` alias working. `isActiveAlias` is true for
  `planning`/`delivering`; `migrateProject` maps a legacy `active` status to
  `delivering` and reports what it repaired. Never store `active`.
- Never silently discard an unrecognised value. `migrateProject` reports a note
  for every repair; a migration that overwrote a status without saying so was a
  real defect.
- Do not remove or rename a field a reader may already have. Add alongside.
- Add a field to a response only if the reader can ignore it — the board, the
  digest and the dashboard all read `/api/agency/state`.

## 6. Version without churn

See `references/versioning.md` — what counts as breaking, when a prefix is
genuinely justified, and how to add one beside the old path without churning
existing callers.

## Outputs

- The route path, method, request body and response body, with the exact string
  each will use
- The error code for every refusal path, and its HTTP status
- The retry behaviour of the route
- The backward-compatibility note: what existing callers see change (ideally
  nothing)
- The suite to run — `node tools/project_pipeline_test.js` for pipeline
  behaviour, `node tools/agency_rules_test.js` for agency rules,
  `node tools/read_path_purity_test.js` when a GET is involved

## Common mistakes

- Copying a route string from the design doc into a plan as if it existed
- Returning a free-text error and losing the code
- Taking the acting role from the request body
- A POST that creates a second project when the client retries
- Renaming or redefining a field an existing reader depends on
