---
name: sql-performance
description: "Read a query plan before adding an index, size the query to the work it does, and reach SQL through the database MCP server or the office's one local SQLite read."
---

# Tune SQL by measuring, not by guessing

Produces a query whose plan you have read and an index you can justify — or
no index at all, because the query did not need one. Use when a SQL query is
slow, when someone proposes an index, or when a query against a real
database has to be written for the first time.

## What SQL is actually in play here

- The **office's own store is JSON files**, not SQL. Do not write SQL
  against the office's records — see the `database-schema` skill.
- The office runs exactly one SQL statement: `token-savings.js` reads
  caveman's recovery database, `SELECT content_type, compressor,
  tokens_before, tokens_after FROM recoveries`, from the read-only SQLite
  file `${CAVEMAN_DIR:-/root/.caveman}/ccr.db`. `node:sqlite` exists only
  from Node 22; this host runs Node v20.18.0, so `require('node:sqlite')`
  throws and the code falls back to the `sqlite3` CLI path. Check which path
  is live before quoting a savings figure.
- Everything else runs through the **database MCP server**
  (PostgreSQL / MySQL / SQLite) — the place to write and measure SQL.

## Reaching the database

See `references/database-mcp.md` for the MCP server's calls in order —
`conn_list`, `conn_create`, `conn_switch`, `conn_set_default`,
`search_schema`, `execute_query`, `execute_mutation`, `rollback_list` /
`rollback_apply`, `explain_query` and `inspect_last_query` — with their
arguments, defaults and modes.

Keep the context small: `verbosity: 'minimal'` for counts and health
checks, `only_columns` to project, `max_rows_in_response` to peek.
## Read the plan before you add an index

- Run `explain_query` on the query **as it is today**. A plan you have not
  read is a guess about where the time goes.
- Look for the shape that matters: a sequential scan over a large table
  where the query filters on an indexed column, a sort that discards an
  index order, or a nested loop whose inner side is re-read per outer row.
- An index helps when the query filters, joins or sorts on that column, the
  table is large, and the query runs often. In PostgreSQL the plan says
  `Seq Scan` versus `Index Scan`; a `Seq Scan` on a small table is not a
  problem.
- An index is pure write overhead when the column is never filtered,
  joined or sorted on, when the column is not selective (most rows share the
  value), or when the table is small enough to scan. Every index is
  maintained on every INSERT, UPDATE and DELETE — it is paid for on the
  write path whether or not any query uses it.
- After creating one, re-run `explain_query` and confirm the plan changed.
  An index that does not change the plan is pure overhead: drop it.

## Composite and covering indexes

- Column order in a composite index is the order of use, not the order of
  the table: equality columns first, then the range column, then the sort
  column. A composite index serves any leftmost prefix — `(a, b, c)` serves
  `a`, `(a, b)` and `(a, b, c)`, but not `b` alone.
- A covering index also contains every column the query returns, so the
  plan can read the row from the index alone (an index-only scan). In
  PostgreSQL: `CREATE INDEX ... ON t (a) INCLUDE (b, c)`. In SQLite the
  index covers when every selected column is in it. A covering index is the
  cure for a plan that still visits the table after a good index lookup.

## The cost of `SELECT *`

- On a wide row it reads, transfers and formats every column, including
  the ones nobody asked for. It also defeats a covering index: the plan
  must visit the table for the columns the index does not hold.
- Select the named columns the caller uses. With the MCP server,
  `only_columns` projects the result further without changing the SQL.
- The same rule applies to the office's own JSON reads: `agency.state()`
  returns a whole board; the board console asks for the fields it renders.

## N+1 detection and the fix

- An N+1 is one query per item inside a loop: fetch a list, then query per
  row. Symptom: the query count grows with the row count while the
  per-query cost stays flat.
- Find it by counting the queries a request issues, not by reading the
  loop. In the MCP server the history is visible: `history_list` shows the
  calls a session made.
- Fix it with a join, or with one query using `IN (...)` and a map built in
  memory. The office does the in-memory version: `agency.tasksById(d)`
  builds an id → task map so N lookups become one pass.

## Measure, do not guess

- Before: `explain_query` on the current SQL, and the row count the query
  actually returns.
- After: the same plan again, plus the wall time the server reported
  (`execute_query` returns an execution time).
- A change that cannot be re-measured is not finished. If a check cannot be
  run — no connection, no permission, read-only mode — say which check was
  skipped and why, instead of reporting a result you did not observe.

## Outputs

The plan before and after, the query as executed, the index statement if one
was justified, and the measured numbers. No row dumps.

## Common mistakes

- Adding an index from habit, then never re-running the plan.
- A composite index whose first column is not the one the query filters on.
- `SELECT *` on a wide table, then calling the result set "the problem".
- Fixing an N+1 with a bigger cache instead of one query.
- Writing SQL against a table that `search_schema` does not show.
- Creating a connection and quietly leaving it in read-write mode.
