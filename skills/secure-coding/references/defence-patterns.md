# Defence patterns for this stack — the evidence

The rules in `SKILL.md` and where each one holds in this office, with the wrong
form to avoid. The OWASP-style class is in brackets on each heading.

## The three boundaries [A01]

1. **HTTP body → office mechanism → `state/*.json`.** `server.js` handlers parse
   the body with `readJsonBody` (server.js:791) and pass fields into
   `agency.*`. Every one of those fields is caller-controlled.
2. **Caller text → agent prompt.** A goal, a task title or a blocked reason
   becomes text handed to a tool-capable OpenCode session. `asData`
   (server.js:124) and the UNTRUSTED DATA blocks (server.js:507, server.js:1462)
   are the defence.
3. **`state/` on disk.** `state/client.json` is mode 0600 (client.js:53) and
   holds the owner bot token; the rest of `state/` is plain JSON the server
   rewrites in memory.

## Broken access control — the role comes from server state [A01]

- `agency.transitionProject` takes `opts.actingRole` (agency.js:433) and hands
  it to `pipeline.canTransition` (project-pipeline.js:270), where P7
  (`wouldSelfAccept`, project-pipeline.js:181) and P8
  (`isAcceptorAuthorised`, project-pipeline.js:190) are decided.
- `ACCEPTOR_ROLES` is `['product_owner_product_manager', 'client']`
  (project-pipeline.js:58) and `client` is **not** a `ROSTER` matrixRole —
  ROSTER (agency.js:85) has no `client` entry. A "known role?" check would
  reject the one role the owner acts through, and that is exactly the check a
  caller-supplied field needs to pass.
- Live instance: `POST /api/agency/approve` passes `body.role` into
  `agency.approveGate` (server.js:1762, agency.js:941), checked only against
  `gate.approverRoles`, so the `security_signoff` gate can be self-issued.
- Same shape: `agency.answerDecision` (agency.js:1464) takes `answeredBy` from
  the body at server.js:1979.
- The design for the identity layer is `docs/design-api-identity.md`; until it
  exists, no route may accept a role.

## Insecure design — validate at the route edge [A04]

- Copy this pattern: `agency.updateTask` (agency.js:1290) validates estimate,
  project, sprint, phase and role *before* it mutates, so a rejected patch
  leaves the task untouched.
- Do not do this: hand `body` to a function that reads a field as
  authoritative — `agency.createTask(body)` (server.js:1722) trusts `body.role`
  and `body.ownerId`.
- Cap every free-text field you accept. `verifyCriterion` refuses evidence
  over 2000 characters (agency.js:544); `isFalsifiableCriterion` refuses
  criterion text over 300 (project-pipeline.js:101).
- Refuse with a code, not a sentence: `invalid_status`, `invalid_role`,
  `unknown_project`, `sprint_project_mismatch`, `invalid_estimate_hours`,
  `invalid_deliverable`, `missing_deliverable_ref`.

## Data integrity — no caller-supplied verdict [A08]

- The real forgery defect: `setAcceptanceCriteria` once stored the caller's
  `met`, `evidence` and `metBy`. Today `pipeline.normaliseCriterion`
  (project-pipeline.js:165) forces `met: false`, `metBy: []`, `evidence: null`,
  and `agency.setAcceptanceCriteria` (agency.js:486) maps it over the caller's
  array before `validateChecklist` runs.
- `agency.verifyCriterion` (agency.js:509) is the only path that sets `met`. It
  refuses without evidence (`criterion_unverified`), with evidence over 2000
  characters, with a `metBy` task that is not one of this project's own tasks,
  and with `criterion_frozen` once the project is accepted.

## Injection — the five classes that fit this stack [A03]

There is no SQL in the office store: `state/` is JSON files. The only query is
a constant, read-only `SELECT` against the caveman cache DB
(token-savings.js:83, no interpolation).

- **Path traversal.** Build every path with `path.join` from a fixed root and a
  name you control; never from a body-supplied filename. The static handler at
  the end of server.js uses `path.join(ROOT, ...)` with a `startsWith(ROOT)`
  prefix check and an unguarded `decodeURIComponent` — a prefix check accepts
  `public-backup/`; containment belongs to `path.relative`.
- **Prototype pollution.** The office never spreads a request body into a
  stored object — keep it that way. Copy named fields. `Object.assign(target,
  parsed)` and `target[k] = parsed[k]` loops invoke the `__proto__` setter;
  object spread creates an own property and is safe.
- **Command injection.** Every external call uses `child_process.execFile` with
  an argv array (server.js:583, server.js:784, capacity.js:66). No `shell: true`
  anywhere. Keep it that way: never `exec`/`execSync` a concatenated string.
- **Prompt injection.** Caller text goes in the data position only, quoted by
  `asData` (server.js:124) inside an UNTRUSTED DATA block (server.js:507,
  server.js:1462). Board values — task titles, blocked reasons — are
  attacker-controlled and travel the same way.
- **DOM.** Render API values through `esc()` (public/index.html:872) or `el()`
  (public/index.html:878). Raw `innerHTML` interpolation is a finding.

## Secret handling — `state/client.json` [A02]

- `state/client.json` (mode 0600, written by client.js:53) holds the owner bot
  token; `TELEGRAM_BOT_TOKEN` in the environment is the fallback (client.js:46).
- Never log it, echo it in a report or digest, embed it in an agent prompt,
  quote it in a commit message, or commit it. `briefing.digest` goes to the
  owner channel — a token must never reach it.
- `state/` is gitignored in the office repo (`.gitignore:3`). Confirm with
  `git -C /home/opencode/virtual-office check-ignore -v state/client.json`
  before you rely on it.
- If a token is exposed, rotate it — deleting the file is not remediation.

## Vulnerable and outdated components — dependency hygiene [A06]

The office has zero runtime dependencies and no `package.json`. Every
`require()` in `*.js` resolves to a Node built-in or a relative path; a bare
package name is itself a finding, because it breaks the property that
`node file.js` runs the office directly. The only dependency declared in this
organisation is `bootstrap-pkg/infra/package.json` (`http-proxy`).
