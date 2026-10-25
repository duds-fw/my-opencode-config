# Putting the six-stage pipeline on the HTTP API

`server.js` contains **no** reference to `project-pipeline.js`, and **no** call
to `transitionProject`, `setAcceptanceCriteria`, `verifyCriterion`,
`projectDetail` or `listProjects`. The pipeline is exercised by
`tools/agency_transition_test.js` and `tools/project_pipeline_test.js`,
which call `agency.js` directly.

The only pipeline-adjacent route is `POST /api/agency/project`, which calls
`agency.createProject` — so it creates a project at `registered`. Nothing
can move that project to `triaged` over HTTP today.

## What implementing "the pipeline over HTTP" means

Add routes that call the domain functions, each returning that domain object's
own `{ ok, reason }` result, and each taking the acting role from the
authenticated principal (per `docs/design-api-identity.md`) and never from the
body. It does **not** mean re-implementing the stage machine in the handler.

- `agency.transitionProject(projectId, toStatus, { actingRole })`
- `agency.setAcceptanceCriteria(projectId, criteria)`
- `agency.verifyCriterion(projectId, criterionId, met, evidence, opts)`

Each route answers with the domain object's own `{ ok, reason }` result; the
route does not decide whether the action is allowed, and it does not rewrite
the reason into free text. See the `error-handling` skill for the code
vocabulary and the `api-design` skill for the envelope and HTTP status per
code.

## What must not happen

- The stage machine is not re-implemented in `server.js`. `project-pipeline.js`
  owns the vocabulary, the transitions and the invariants; `agency.js` owns
  the state.
- The acting role is never read from the request body.
- A new refusal code is never invented: the pipeline speaks
  `project_not_registered`, `no_acceptance_criteria`, `criterion_not_falsifiable`,
  `missing_deliverable`, `illegal_project_transition`, `acceptance_not_met`,
  `criterion_unverified`, `self_acceptance`, `acceptor_not_authorised`, plus
  `criterion_frozen` and `missing_deliverable_ref`.
- A GET route that moves the project between stages is never added: a read
  must not write (`tools/read_path_purity_test.js`).
