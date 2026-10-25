# OWASP Top 10 mapped onto this stack

| OWASP | Surface here |
|---|---|
| A01 Broken access control | the HTTP API has no authentication; `ACCEPTOR_ROLES`, `wouldSelfAccept`, `approveGate` |
| A03 Injection | no SQL in the store — path, command, prompt and DOM injection instead |
| A04 Insecure design | the pipeline invariants P1-P9 and the two-act acceptance model |
| A05 Security misconfiguration | `Access-Control-Allow-Origin: *`, `HOST` default `0.0.0.0`, the static file handler |
| A07 Identification & authentication failures | every route; `/api/client/*` |
| A08 Software & data integrity failures | `deliverable.ref`, prompts built from untrusted data, `state/` writes |
| A09 Logging & monitoring failures | HTTP-level logging of mutating calls; actor identity in the trail |
| A10 SSRF | only if a URL is taken from a body — check; the fetch targets today are fixed |

## Not applicable, with the reason

**A02 Cryptographic failures** and **A06 Vulnerable components** are the two
categories that do not apply here; the reasons are in SKILL.md and must be
recorded with the findings ("not applicable, with reason" — do not pad the
list).

## Where each one is checked

- A01 / A07 — the grep and route list in SKILL.md's "No auth on the HTTP API"
  and "Broken access control in the domain".
- A03 — "Injection (A03)": path, command, prompt, DOM.
- A05 — "Security misconfiguration (A05)".
- A08 — "Data integrity (A08)".
- A09 — "Logging (A09)".
