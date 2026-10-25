---
name: secure-coding
description: "Write secure code in the dependency-free Virtual Office: validate at the HTTP edge, derive roles from server state, refuse caller-supplied verdicts, keep the owner token secret."
---

# Write secure code in this office

Produces code that is safe by construction in a stack with no framework, no
runtime dependency and no auth layer yet. Use when adding or changing a route,
a write path, a prompt, or anything that touches `state/`. The file:line
evidence for each rule below, and the wrong form to avoid, are in
`references/defence-patterns.md`.

## The three boundaries that exist here

1. **HTTP body → office mechanism → `state/*.json`.** Handlers parse the body
   with `readJsonBody` and pass fields into `agency.*`; every one of those
   fields is caller-controlled.
2. **Caller text → agent prompt.** A goal, a task title or a blocked reason
   becomes text handed to a tool-capable OpenCode session. `asData` and the
   UNTRUSTED DATA blocks are the defence.
3. **`state/` on disk.** `state/client.json` is mode 0600 and holds the owner
   bot token; the rest of `state/` is plain JSON the server rewrites in memory.

No route is authenticated today. Do not write code that assumes one, and do
not add a route that assumes one either.

## Validate at the route edge, pass only validated data inward

The edge is the handler that receives untrusted data. It must establish type,
length and membership before the value crosses into `agency.*`.

- Copy this pattern: `agency.updateTask` validates estimate, project, sprint,
  phase and role *before* it mutates, so a rejected patch leaves the task
  untouched.
- Do not do this: hand `body` to a function that reads a field as
  authoritative — `agency.createTask(body)` trusts `body.role` and
  `body.ownerId`.
- Cap every free-text field you accept. `verifyCriterion` refuses evidence
  over 2000 characters; `isFalsifiableCriterion` refuses criterion text over
  300.
- Refuse with a code, not a sentence: `invalid_status`, `invalid_role`,
  `unknown_project`, `sprint_project_mismatch`, `invalid_estimate_hours`,
  `invalid_deliverable`, `missing_deliverable_ref`.

## An authorization decision is computed from server state

**Never** read the acting role from a request body. `agency.transitionProject`
takes `opts.actingRole` and hands it to `pipeline.canTransition`, where P7
(`wouldSelfAccept`) and P8 (`isAcceptorAuthorised`) are decided.

You cannot repair this by validating the role against the roster.
`ACCEPTOR_ROLES` is `['product_owner_product_manager', 'client']` and `client`
is **not** a `ROSTER` matrixRole — ROSTER has no `client` entry. A "known
role?" check would reject the one role the owner acts through, and that is
exactly the check a caller-supplied field needs to pass. Map an authenticated
identity to a role server-side and let the body carry no role at all. The
design for that layer is `docs/design-api-identity.md`; until it exists, no
route may accept a role.

- Live instance: `POST /api/agency/approve` passes `body.role` into
  `agency.approveGate`, checked only against `gate.approverRoles`, so the
  `security_signoff` gate can be self-issued.
- Same shape: `agency.answerDecision` takes `answeredBy` from the body.

## A write path must never accept a caller-supplied conclusion

The body may carry raw input — a claim, a task id, a note. It may never carry
the verdict the office is supposed to reach. `pipeline.normaliseCriterion`
forces `met: false`, `metBy: []`, `evidence: null`, and
`agency.setAcceptanceCriteria` maps it over the caller's array before
`validateChecklist` runs — a caller-supplied verdict is discarded, not stored.

- `agency.verifyCriterion` is the only path that sets `met`. It refuses
  without evidence (`criterion_unverified`), with evidence over 2000
  characters, with a `metBy` task that is not one of this project's own tasks,
  and with `criterion_frozen` once the project is accepted.
- Ask of every field you accept: *what does this let the caller assert?* If the
  answer is a verdict, an identity or a role, it must not be accepted raw.

## Secret hygiene — `state/client.json`

- `state/client.json` (mode 0600) holds the owner bot token; `TELEGRAM_BOT_TOKEN`
  in the environment is the fallback.
- Never log it, echo it in a report or digest, embed it in an agent prompt,
  quote it in a commit message, or commit it. `briefing.digest` goes to the
  owner channel — a token must never reach it.
- `state/` is gitignored in the office repo. Confirm with
  `git -C /home/opencode/virtual-office check-ignore -v state/client.json`
  before you rely on it.
- If a token is exposed, rotate it — deleting the file is not remediation.

## Injection defences that fit this stack

There is no SQL in the office store: `state/` is JSON files. The five classes
that apply here — path traversal, prototype pollution, command injection,
prompt injection and DOM — with the right and wrong form of each, are in
`references/defence-patterns.md`.

## Dependency hygiene

The office has zero runtime dependencies and no `package.json`; a bare package
name in a `require()` is itself a finding. The only dependency declared in this
organisation is `bootstrap-pkg/infra/package.json` (`http-proxy`).

## Outputs

- The validated data flowing inward and the coded refusals flowing outward.
- The suites that prove a refused call left state untouched.
- A statement of any secret you handled and where it went.

## Common mistakes

- Validating in the route and letting the domain function trust the result.
- Reading `role`, `answeredBy` or `met` out of the body.
- Validating a role against `ROSTER` and believing that is an auth check.
- Logging `state/client.json` "just to see the config".
- Swallowing an exception into a default success.
