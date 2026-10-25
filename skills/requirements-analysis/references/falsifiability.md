# Falsifiability rules — verbatim from the source

`isFalsifiableCriterion(text)` in `virtual-office/project-pipeline.js`
(lines 100–129). Every list below is the code's own.

## The six rules, in the order the code applies them

1. Not a string → refuse.
2. Trimmed text is empty → refuse.
3. `text.length > 300` → refuse.
4. Split on `/[.!?]+(?:\s|$)/`, keep the non-empty parts. More than one part →
   refuse (one criterion is one claim).
5. `text.length < 12` → refuse (too short to state a checkable condition).
6. Goal language → refuse.
7. Comparative or qualitative claim → refuse.
8. No checkable subject → refuse.

Otherwise the criterion passes.

## Rule 6 — goal language

```
should | could | would like | as fast as possible | better | nicer | goal |
aim | want | good | great | nice | make it | improve
```

The code's comment: *"Goal language describes an outcome, not a checkable
condition."* A goal belongs in `project.goal`.

## Rule 7 — comparative or qualitative claims

```
fast | slow | quick | responsive | efficient | clean | simple | robust |
secure | reliable | scalable | maintainable | readable | beautiful | easy |
intuitive | seamless | professional
```

The code's comment: *"Comparative or qualitative claims describe a degree, not a
state. They may name a real artefact ('the API is fast') and still not be
checkable, because nothing states the threshold. A criterion names the
threshold itself."*

## Rule 8 — the checkable subject families

The text must match at least one of these eight regexes:

| Family | Matches |
|---|---|
| API | api, endpoint, route, request, response, payload, json, status code, header, body, schema |
| Code | file, module, function, class, method, script, repo, repository, code, commit, branch, test, test suite, build |
| UI | ui, button, form, page, screen, component, layout, style, css, icon, favicon, render |
| Config | config, setting, option, flag, environment, variable, manifest, package |
| Report | dashboard, report, metric, number, count, total, rate, percentage, latency, uptime, log, audit |
| Access | user, role, permission, access, token, session, credential, login, auth, password, policy |
| Data | record, row, column, table, database, migration, seed, data |
| Error | error, exception, failure, warning, exit code, return code, status |

## Worked examples

Verified by running `isFalsifiableCriterion` against the real function.

| Text | Result |
|---|---|
| `make it good` | refused — rule 6 and no subject |
| `the API is fast` | refused — rule 7 |
| `improve the onboarding flow` | refused — rule 6 |
| `the code is secure` | refused — rule 7 |
| `the criterion is verifiable` | refused — no subject family |
| `the endpoint returns status code 204 for a request with an expired token` | passes |
| `the response latency is under 200 ms at p95 for 1000 concurrent requests` | passes |
| `the UI renders the board with all tasks of the selected project` | passes |
| `the auth middleware rejects a request with an invalid token` | passes |
| `the exit code of the test run is 0` | passes |

## Refused, and what to rewrite it to

Each right-hand text below was run through `isFalsifiableCriterion` and
passes.

| Refused | Why | Rewrite |
|---|---|---|
| `make it good` | goal language, no subject | `the endpoint returns status code 204 for a request with an expired token` |
| `the API is fast` | comparative, no threshold | `the response latency is under 200 ms at p95 for 1000 concurrent requests` |
| `improve the onboarding flow` | goal language | `the UI renders the board with all tasks of the selected project` |
| `the code is secure` | qualitative claim | `the auth middleware rejects a request with an invalid token` |
| `the criterion is verifiable` | names no checkable subject | `the exit code of the test run is 0` |

When a request resists rewriting, say which part is the goal and which is the
measurable part. The pattern is to name a checkable subject and state the
threshold itself.

## The two things that must never appear in a checklist write

`normaliseCriterion` discards them, and supplying them signals a forged
intent: `met`, `evidence`, `metBy`.

The verdict is reached by `verifyCriterion`, which is a separate, authorised
step that requires evidence and this project's own task ids.
