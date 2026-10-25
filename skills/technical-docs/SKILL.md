---
name: technical-docs
description: "Write or update the office's docs/ so every claim is verifiable against source — correct layout and naming, matching API routes, and no stale assertions about what the code does."
---

# Write documentation that stays true to the code

Produces a document that a reader can check against the source, in the office's
existing layout and naming. Use this when writing a new document, or when an
implementation change has just made an existing document wrong.

## Use the existing layout and naming

Check `docs/` before creating anything. The office's documents live flat in
`docs/`, named in kebab-case with a prefix that states the kind: `design-`,
`agency-`, `sop-`, `role-` or `sprint-`.

Never add a document whose kind is not one of these. See
`references/docs-inventory.md` for the naming rules, what each existing file
holds, and which authority outranks which.

## Update the document in the same change

When an implementation change makes a document wrong, fix the document in the
same change that made it wrong. A stale document is worse than no document:
the office's own rule is that an agent following a stale document will do the
wrong thing, and `tools/sop-consistency-check.js` exists to make that
disagreement loud.

The order of authority is fixed: `agency.js` is the mechanism,
`docs/agency-decisions.md` is the authority, `docs/sop-virtual-office.md` is the
procedure, `docs/role-guidelines.md` is the role detail. A document never
overrides the code.

## Every claim must be verifiable against source

Before a document asserts something about the code, open the code and confirm
it. The claim "the pipeline is wired into the server" is currently **false**:
`server.js` contains no reference to `project-pipeline.js` — the module is
required by `agency.js` only. A document that says otherwise sends readers to
look for an endpoint that does not exist.

The same discipline applies to names. Write the field as the source spells it
(`project.id`, `task.projectId`, `deliverable.ref`), the function as it is
exported (`agency.verifyCriterion`, `pipeline.checkDoneGates`), and the
error code as the source emits it.

A good document says what the code does *today* and names where to look:
`project-pipeline.js` `checkDoneGates()`. A design that describes intended
future behaviour belongs in the design document, labelled as intent.

## Know which kind of document you are writing

- **Design** — why the shape is this shape. Kept in `design-*.md`. Describes
  the target; may include a phase plan that is not yet implemented.
- **Decision record** — what was decided and why, and by whom. Kept in
  `agency-decisions.md` with a `## D<n>` heading. Decisions are never edited
  to match the code; a change of mind is a new decision that supersedes the
  old one.
- **Runbook** — how to do a recurring operation: how to restart the service
  (`systemctl restart virtual-office.service`), which suites to run, what a
  refusal code means. Keep it operational and short.
- **Role guidelines** — what one role does at each stage, and which SOP
  clauses bind it. Kept in `role-guidelines.md`, one section per role.

Never let one kind drift into another. A decision record that grows a tutorial
is a runbook written in the wrong file.

## An API reference must match the real route strings

Copy the route strings out of `server.js`. Routes are registered as
`pathname === '/api/agency/...' && req.method === 'POST'` comparisons, so the
literal string in the source is the reference.

Check the route exists before documenting it. `docs/design-project-pipeline.md`
§5 lists `POST /api/agency/project/:id/triage`, `/plan`, `/deliver`,
`/verify`, `/accept`, `/ratify`, `/cancel`, `GET /api/agency/project/:id`,
`GET /api/agency/projects` and `GET /api/agency/timeline`. Only
`POST /api/agency/project` is registered in `server.js` today. That document is
a *design* and may describe intended routes — but a reference document
describing routes as live must list only registered ones, and must not present
a planned route as if it answers requests.

When documenting a live route, give the method, the exact path, the request
fields and the refusal codes the route can return.

## Do not regenerate large collections unnecessarily

`graphify-out/` is a generated knowledge graph — `graph.json`, `graph.html`,
`GRAPH_REPORT.md`, `manifest.json`. Do not regenerate it because a document
changed. A targeted edit to the one file that is wrong costs far less than
rebuilding the collection.

The same rule applies to the office's own knowledge: edit the section that is
wrong. Do not rewrite `docs/role-guidelines.md` (77KB) or
`docs/sop-virtual-office.md` (49KB) to fix one clause, and do not rewrite
`docs/agency-decisions.md` to record a new decision — append it.

Prefer adding a short, targeted section over expanding an existing one that
already answers the question.

## Outputs

- A document at `docs/<kind>-<subject>.md` (or an edit to the existing one)
  whose claims are checkable against the source.
- Every route, function, field and error code named as the source spells it.
- A note of any claim that could not be verified, and why.

## Common mistakes

- Asserting that a module is wired into a surface it is not wired into.
- Copying an intended API contract into a reference as if it were live.
- Editing a decision record instead of appending a superseding decision.
- Regenerating `graphify-out/` for a one-line change.
- Leaving the document behind after the code moved.
- Inventing a file name that does not match the `docs/` convention.
