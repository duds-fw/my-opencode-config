# Reaching the database through the MCP server

The calls the database MCP server exposes, in the order you use them.

1. `conn_list` — list the connections and see which one is active. In a
   fresh environment this reports that no connections are configured.
2. `conn_create({ name, type, group, ... })` — every connection belongs to
   a group; `type` is `postgresql`, `mysql` or `sqlite`; `mode` defaults to
   **read-only**, which blocks `execute_mutation`. Supply `dsn`, or
   `host` / `port` / `database` / `user` / `password`, or `filepath` for
   SQLite. `conn_switch` sets the session's active connection;
   `conn_set_default` persists the default.
3. `search_schema({ object_type, pattern, schema, detail_level })` — know
   the tables before writing SQL. `detail_level` is `names`, `summary` or
   `full`; `pattern` accepts SQL wildcards (`%order%`). **Never invent a
   table name**: read it from the schema.
4. `execute_query({ sql, params, limit, ... })` for reads; a `LIMIT` is
   injected when the query has none. `execute_mutation` for writes — it
   takes a rollback snapshot, and `rollback_list` / `rollback_apply` undo
   it (ask before applying).
5. `explain_query({ sql, params, analyze })` for the plan. `analyze: true`
   **runs the query for real** — use it only on a read.
6. `inspect_last_query({ call_id })` recovers a truncated cell without
   re-running the query.

A `LIMIT` is injected on a read that has none, so a large result set is
already bounded — project it further with `only_columns` rather than
re-running the query narrower.
