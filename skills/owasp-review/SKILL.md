---
name: owasp-review
description: "Audit the Virtual Office against the OWASP Top 10: map each category onto the HTTP API, the JSON state store and the agent delegation boundary, then report findings with file:line."
---

# Audit this stack against OWASP Top 10

Produces findings that name a file, a line, a concrete trigger and an impact —
for this stack, not a generic list. Use before a release, or when asked for a
security assessment of the office.

## Map the categories onto what this stack exposes

The office is a hand-rolled `node:http` API (`server.js`), a JSON state store
(`state/`), and a delegation boundary that hands text to a tool-capable agent
session. Map the categories onto those three surfaces — the full
category→surface table is in `references/owasp-mapping.md`.

**A02 Cryptographic failures does not apply.** There is no TLS, no password
hash, no session cookie, no encryption at rest and no crypto in the state
format; the control on `state/client.json` is file permission (0600). **A06
Vulnerable components is nearly empty**: the office has zero runtime
dependencies (see the `dependency-audit` skill). Record both as "not
applicable, with reason" — do not pad the list.

## The checks that actually apply

**No auth on the HTTP API (A01/A07).**
Check: `grep -n "authorization\|x-api\|apiKey\|hmac\|principal" server.js` →
no hits; `grep -n "Access-Control-Allow-Origin" server.js` → `*`.
Finding: any mutating route reachable by an unauthenticated caller — the state
mutations (`/api/agency/task`, `/api/agency/approve`, `/api/agency/task/:id`),
the owner channel (`/api/client/setup`, server.js:1930), the owner decision
(`/api/client/decision/answer`, server.js:1976), the autonomy controls
(`/api/autonomy/budget`, `/api/autonomy/stop`) and the agent prompt route
(`/api/orchestrate/goal`, server.js:1423).

**Broken access control in the domain (A01).**
- `ACCEPTOR_ROLES` (project-pipeline.js:58) is `product_owner_product_manager`
  and `client`; `client` is not a ROSTER matrixRole (ROSTER, agency.js:85), so
  a role check that resolves against ROSTER silently excludes the owner.
- `wouldSelfAccept` (project-pipeline.js:181) compares the accepting role with
  the roles of the tasks behind the met criteria. A finding is any path where
  the accepting role is not derived from an authenticated identity.
- `agency.approveGate` (agency.js:941) checks the role only against
  `gate.approverRoles`, and the route passes `body.role` (server.js:1762). A
  gate that can be self-issued is the finding.

**Sensitive data exposure (report under A01/A07).**
Check: `ls -l state/client.json` (expect mode 0600), `grep -rn "botToken" *.js`,
and every place a config value is logged or digested. A finding: a credential
in a log, a report, a prompt or a commit.

**Injection (A03).**
- Path: the static handler at the end of `server.js` — `decodeURIComponent`
  outside a try/catch, and containment by `startsWith(ROOT)`, which accepts a
  sibling directory whose name begins with `public`.
- Command: `grep -rn "shell: *true" *.js` → none; any `exec`/`execSync` with
  a concatenated string is a finding. The `execFile` argv usage
  (server.js:583) is the pattern to keep.
- Prompt: `asData` (server.js:124) and the UNTRUSTED DATA blocks
  (server.js:507, server.js:1462) are the control. A finding is caller text
  that reaches a prompt outside a quoted data position.
- DOM: `grep -n "innerHTML" public/index.html` — every API-derived value must
  pass through `esc()` (public/index.html:872) or `el()` (public/index.html:878).

**Security misconfiguration (A05).**
`HOST` defaults to `0.0.0.0` (server.js:8) and CORS is `*` (server.js:1412),
so the API is reachable from the network and from any page the owner opens.
`OPENCODE_BIN` is env-controlled (server.js:10). The static handler serves any
extension, falling back to `text/plain`.

**Data integrity (A08).** `agency.updateTask` (agency.js:1335) accepts any
non-empty `ref` as the commit SHA of a code deliverable, so a bogus ref passes
certification. Check every guard's field names against the record it reads.
**Logging (A09).** The activity journal exists (`activity-journal.js`), but
mutating HTTP calls are not logged with an actor, because there is no actor.

## Rate by exploitability here

Ask who can reach it, then what it buys them.

- **critical** — an unauthenticated caller on a `0.0.0.0` bind can change
  state, take the owner channel, forge an owner decision, or inject text into
  a tool-capable agent session.
- **high** — the same defect against a 127.0.0.1-bound instance, a verdict any
  caller can forge, or a guard that cannot fire.
- **medium** — a real defect on an edge path: a decoder that throws, a body
  limit that never answers, a containment check that is a prefix match.
- **low** — a genuine smell with no reachable path.

The difference between critical and high here is reachability, not intent.

## Report format

Use the format the previous review of this codebase used
(`docs/agency-security-review.md`): `id | severity | file:line | concrete
trigger | impact | fix`. Read that file first — it holds 20 prior findings
(F-01..F-20) with the triggers already worked out. Its line numbers are from
the build it reviewed: re-verify each with `grep -n` before quoting it, and
say which findings still reproduce. Never expose a secret you found — report
the location, the mode and the rotation advice, never the value or a prefix.

## Outputs

- Findings in severity order, each with file:line, trigger, impact and fix.
- The categories judged not applicable, with the reason.
- The prior findings re-checked, and the ones that no longer reproduce.

## Common mistakes

- Producing the OWASP list from memory instead of reading this stack.
- Rating by category name instead of by reachability.
- Reporting a secret's value "to be helpful".
- Quoting a line number from the old review without re-checking it.
- Padding with advice that would read the same in any repository.
