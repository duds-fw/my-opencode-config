# Versioning without churn

No route carries a version prefix today: `/api/agency/*`, `/api/client/*`,
`/api/autonomy/*`, `/api/opencode/*`.

So an additive change ships on the **existing path** — do not open
`/api/v2/...` for a new field.

## First check whether it is breaking at all

These are **non-breaking**:

- a new *optional* field in a response;
- a new route;
- a new error code on a path that already returned an error.

A reader may ignore a field it does not know. The board, the digest and the
dashboard all read `/api/agency/state` — a field they do not read is
harmless.

## What is breaking

- Removing or renaming a field a reader may already have.
- Changing a field's type or meaning.
- Changing the status a route returns for a given condition.
- Narrowing a route's accepted input.

## When a prefix is genuinely needed

1. Add the new path **beside** the old one. `/api/v2/...` answers
   alongside `/api/...`.
2. Keep the old path answering. Both live until the old one retires.
3. Record the retirement date in the route's own comment, so the code carries
   its own deprecation.
4. Migrate the office's own callers first, then the external ones.

## Never

- Never silently discard an unrecognised value. `migrateProject` reports a
  note for every repair; a migration that overwrote a status without saying
  so was a real defect.
- Never remove or rename a field a reader may already have. Add alongside.
- Add a field to a response only if the reader can ignore it.
