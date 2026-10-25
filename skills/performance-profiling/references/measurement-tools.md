# The measurement machinery that already exists

Check these before writing a collector. A new collector that duplicates one of
them is a second source of truth.

- `token-savings.js` → `collect({ spentTokens })` returns `totalSaved`,
  `percentOfSpend`, `baselineTokens`, `rtk.byCommand`, `caveman.byType`. It
  reads RTK's own counter and caveman's `ccr.db` recoveries.
- `token-compliance.js` → `collect({ tokens })` returns `grade`
  (`healthy`/`weak`/`at-risk`/`failing`), `advice`, `rtk.proxied`,
  `rtk.passthrough`, `roles.atCeiling`. It is **not** currently required by
  `server.js` — do not report its output as live until you wire it.
- `GET /api/agency/tokens` → `spentToday`, `budget`, `percent`, `allowed`.
- `fetchTokenUsage()` in `server.js` → per-session and per-role spend.
- `agency.metrics(projectId)` → `leadTime`, `sla.compliance`, `utilization`.
- `recordAutonomyRefusal(usage, reason, consumer, limit)` → `usage.refusals`
  counts, `usage.refusalLog` (capped at 50 entries).
- `session-guard` plugin (`~/.config/opencode/plugins/session-guard.ts`) →
  prefix size per turn; it compacts at `THRESHOLD_TOKENS = 150_000`.
