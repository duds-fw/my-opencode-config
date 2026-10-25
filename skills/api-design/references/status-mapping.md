# Code-to-status mapping

The office uses 200/400/404/409/500 today.

| Code | Status |
|---|---|
| `project_not_registered` | 404 |
| `no_acceptance_criteria`, `criterion_not_falsifiable`, `missing_deliverable`, `missing_deliverable_ref`, `criterion_unverified` | 400 |
| `illegal_project_transition`, `acceptance_not_met`, `criterion_frozen` | 409 |
| `self_acceptance`, `acceptor_not_authorised` | 403 |

## Reading the table

- **404** — the thing the caller named does not exist. A missing project, a
  missing task, an unknown id.
- **400** — the request is malformed or contradicts a rule about the payload
  itself: no criteria, a criterion that cannot be falsified, a missing
  deliverable, a deliverable without a commit SHA.
- **409** — the request is well-formed but conflicts with the current state of
  the record: an illegal transition, acceptance with unmet criteria, a
  criterion re-verified after the fact.
- **403** — the caller is not allowed to do this: it accepted its own
  delivery, or it is not an accepting role.

The distinction between 400 and 409 matters to a caller: 400 means "fix the
request", 409 means "the world changed — re-read and retry".

Never return a free-text error where a code is expected. A caller must be
able to branch on the code, and a free-text error is not a contract.
