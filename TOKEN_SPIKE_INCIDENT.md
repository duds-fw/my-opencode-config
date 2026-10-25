# Token Spike Incident Report

**Date:** 2026-10-25
**Severity:** High — Token Plan exhausted (~125M tokens / 5h reported; 385M measured all-time)
**Status:** Root cause fixed, corrective actions implemented and verified

---

## 1. Symptoms

- MiniMax Token Plan showed ~125M tokens consumed in a 5-hour window.
- Quota error 2056 ("Token Plan usage limit reached") appeared across concurrent sessions.
- OpenRouter error: "You requested up to 128000 tokens, but can only afford 9547".
- Sessions failed simultaneously with quota errors.

---

## 2. Confirmed Facts (from telemetry)

All figures below are measured from the authoritative source:
`/root/.local/share/opencode/opencode.db` (table `session_v2`, `session_message`).

### Token breakdown — 385M total

| Bucket | Tokens | Share |
|---|---:|---:|
| **cache_read** | **351M** | **91%** |
| input (uncached) | 33.4M | 8.7% |
| output | 580K | 0.15% |
| cache_write | 0 | 0% |

### Concentration

Two sessions account for **94%** of all tokens:

| Session | Tokens |
|---|---:|
| Virtual office for product operations | 299.6M |
| setup-opencode | 61.4M |

### The mechanism

The dominant session held **1,475 messages / 1,227 token-bearing turns**. Its cached
prefix grew to **555,264 tokens**. Every subsequent turn re-sent that entire growing
prefix, so `cache_read` compounded quadratically.

- The **last 20% of turns consumed 41%** of the session's total cache_read.
- **`time_compacting` was NULL for all 114 sessions — 0 of 114 ever compacted.**

### Root cause: the automatic-compaction threshold was unreachable

`MiniMax-M3.1-Flash` has a **1,000,000-token context window**
(models.dev `minimax-coding-plan`, `limit.context = 1000000`).

OpenCode V2 computes the auto-compaction trigger from the binary as:

```js
Cc = (limit, buffer) => {
  let i = limit.input || limit.context;
  if (i <= 0) return Infinity;
  if (buffer !== undefined) return i - buffer;   // <-- explicit buffer
  return i - Math.max(Math.floor(i * 0.15), i >= 2 * Vc ? Vc : 0);
}
```

With the configured `buffer: 20000` and a 1M context window, compaction would only
trigger at **980,000 tokens**. The largest session peaked at 555K — roughly half the
threshold — so **compaction never ran**. Every turn then re-read a prefix that grew
without bound.

> The 1M context window made the V1→V2 config translation look harmless: the
> previous `tail_turns: 8` policy bounded *turns*, while the V2 `buffer` policy
> bounds *tokens against the model limit*. With a 20x larger limit, the same
> 20,000-token buffer became effectively an off switch.

### Secondary defects found during the investigation

| Defect | Evidence | Impact |
|---|---|---|
| **Invalid JSONC** — a missing comma after `"skills"` | OpenCode silently fell back to defaults: no agents, no MCP servers, no plugins, no compaction config | Office degraded without any error surface |
| **Dead `small_model` reference** | `small_model: "opencode-go/glm-5.3-flash"` resolves to `None`; the model is filtered out of the registry as non-free (`if(!LH.cost.some(J=>J.input>0)) fH.delete(HH)`), so `opencode-go/glm-5.3-flash` does not exist in `opencode models` | Every Title generation failed with `provider.free-limit`; two compaction attempts failed with the same error |
| **`subagent_depth: 2`** | Config | Nested delegation multiplies context across sessions |

---

## 3. Previous vs Current

| Aspect | Previous (v1.18.18) | Current (v2.1.3) | Impact |
|---|---|---|---|
| Compaction policy | `tail_turns: 8` (turn-based) | `keep.tokens` + `buffer` (token-based, relative to model limit) | **Root cause** — same 20K buffer is inert against a 1M window |
| Model context | ~204,800 (M2-class) | **1,000,000** (M3.1-Flash) | 5x headroom for prefix growth |
| Config format | V1 flat keys | V2 nested (`agents`, `commands`, `plugins`, `permissions`, `mcp.servers`) | A single missing comma disables everything |
| Subagent depth | not configured | `2` | Context multiplication |
| MCP servers | 11 (flat) | 12 (nested) | Constant schema overhead — **not** the driver (see §5) |

---

## 4. Ranked Root Causes

1. **PRIMARY — Unreachable auto-compaction threshold (1M context + `buffer: 20000` → trigger at 980K).**
   0/114 sessions compacted; 351M cache_read (91%) from re-reading a growing prefix.
2. **HIGH — Unbounded session length.** 1,227 turns in one session with no reset.
   The last 20% of turns alone consumed 41% of the session's cache_read.
3. **HIGH — Invalid JSONC silently disabling the entire config.**
   No agents, no MCP, no plugins, no compaction — with no error reported.
4. **MEDIUM — `subagent_depth: 2`.** Nested delegation multiplies context across sessions.
5. **LOW — Dead `small_model` reference.** Title generation and two compaction
   attempts failed on quota instead of succeeding.
6. **NOT A CAUSE — MCP schemas, RTK, skills.** These contribute a *constant* per-request
   overhead; they cannot produce quadratic growth. RTK's 36.7% saving on 11 bash
   commands is real but immaterial next to a 351M cache_read problem.

---

## 5. Why the Earlier Hypothesis Was Wrong

An earlier draft of this report attributed the spike to MCP schema overhead, RTK's
limited coverage, skill size, and concurrent sessions. Telemetry disproved each:

- MCP/skills/skills are **constant** overhead — they cannot explain quadratic growth.
- Concurrency was not the driver; the 299.6M came from **one** session's prefix growth.
- 91% of tokens were `cache_read`, not `input` — the cost was re-reading the prefix,
  not loading schemas.

---

## 6. Corrective Actions Implemented

### 6.1 `compaction.buffer: 700000` — proactive compaction

`buffer` is the documented lever: *"Tokens to keep free below the model's limit.
Larger values start automatic compaction earlier."*

| buffer | trigger point |
|---|---:|
| 20,000 (before) | 980,000 |
| **700,000 (after)** | **300,000** |

The prefix can now never exceed ~300K tokens, capping per-turn cache_read at
roughly a third of the observed peak.

Also: `keep.tokens` restored to **15000** (the V2 default — the previous 4000 was
below the documented value), and the deprecated `prune` key removed.

### 6.2 `plugins/session-guard.ts` — explicit session-length guard

A plugin that compacts **before** the prefix grows large, rather than waiting for
the automatic threshold.

- Hooks the `context` event, which fires on every agent-loop request.
- Measures the assembled prefix from `event.messages` (array of
  `{id, role, content, metadata}` — the hook exposes **no token counts**).
- Token estimate uses **4 chars/token**, calibrated against live telemetry:
  a 599,238-char prefix measured 149,184 cache_read tokens → **4.017 chars/token**.
- Threshold **150,000 tokens**; **120s** cooldown; re-entrancy guard.

**Verified end-to-end** (threshold temporarily lowered to 5,000 to force a trigger):
two `status=completed` compaction messages were written, and post-compaction
`cache_read` fell from a growing prefix to a **flat ~128 tokens** per turn.

### 6.3 `subagent_depth: 2 → 1`

Stops nested delegation from multiplying context across sessions.

### 6.4 `small_model` + `agents.title.model` repaired

Both now point to `minimax-coding-plan/MiniMax-M3.1-Flash`.

Note: `small_model` is a **legacy field** that only sets the Title agent's model.
OpenCode filters `opencode-go` models whose cost is non-zero, so
`opencode-go/glm-5.3-flash` does not exist. `agents.title.model` is therefore
pinned explicitly as well. Verified: the Title agent resolves to
`MiniMax-M3.1-Flash` on a fresh config load, and no `provider.free-limit` or
`Model unavailable` errors appear.

### 6.5 Invalid JSONC repaired

Committed separately as `556f9f2` for clean rollback. All 12 MCP servers retained —
the office needs them, and they were not the cause. The `"skills": ["./skills"]`
path was restored; skills load lazily via the `skill` tool, so disabling them saved
negligible tokens while removing real capability.

### 6.6 Deliberately NOT done

- **No MCP servers removed** — not a root cause; removing them would break the office.
- **No skills disabled** — lazy loading; negligible token cost.
- **No `experimental.background_compaction`** — experimental and skipped below ~64K tokens.
- **No session deletion** — forensics must remain reproducible.

---

## 7. Controlled Validation

| # | Step | Result |
|---|---|---|
| 1 | Config validity (JSONC parse) | PASS — valid; 12 MCP servers, 4 plugins, skills path intact |
| 2 | Agent resolution | PASS — 14 agents resolve (incl. `title`, `compaction`, `summary`) |
| 3 | Title model | PASS — resolves to `minimax-coding-plan/MiniMax-M3.1-Flash`; no quota errors |
| 4 | Guard end-to-end | PASS — 2 completed compactions; `cache_read` flat at ~128 tokens post-compaction |
| 5 | Threshold math | PASS — buffer 700,000 → trigger at 300,000 (from 980,000) |
| 6 | Office services | PASS — `opencode-server.service` active (4099, auth-required as expected); `chloe-pwa.service` active (4096, HTTP 200) |

---

## 8. Residual Risks and Limitations

- **Character-based token estimation.** The `context` hook exposes no token counts.
  The 4.017 chars/token ratio was calibrated on English/code; sessions dominated by
  non-Latin text or large binary-ish payloads will estimate low. The 150K threshold
  has ample headroom below the 300K automatic trigger, so the guard errs safe.
- **All free models are quota-exhausted** (`provider.free-limit`) and
  `opencode-go/glm-5.3-flash` is unavailable. Compaction must therefore run on the
  MiniMax Token Plan model. When free quota returns, `agents.compaction.model` can be
  pointed at a free model to take summarization off the plan.
- **The 385M figure is all-time**, not the 5-hour window. The 125M/5h figure is
  user-reported and was not independently reproducible from telemetry.
- **Not restarted from inside a hosted session.** Restarting
  `opencode-server.service` from a session hosted by that server kills the session's
  own host. Use `opencode run --standalone` for config verification instead.
- **Cache-read billing is not confirmed.** models.dev lists `cache_read: 0` for this
  provider, but the Token Plan reports usage regardless. The token *volume* is
  confirmed from local telemetry; the *billing* semantics are provider-side.

---

## 9. Commits

| Commit | Contents |
|---|---|
| `556f9f2` | `fix(config)`: repair invalid JSONC, `subagent_depth` 2→1, `keep.tokens` 8000→4000 |
| *(this commit)* | `fix(config)`: compaction buffer 700000, `keep.tokens` 15000, `small_model`/Title model repair, `session-guard` plugin, corrected report |

---

## 10. Reproduction

```bash
# Token breakdown
sqlite3 /root/.local/share/opencode/opencode.db \
  "select sum(tokens_input), sum(tokens_cache_read), sum(tokens_output),
          count(*), sum(time_compacting is not null) from session_v2;"

# Sessions that ever compacted
sqlite3 /root/.local/share/opencode/opencode.db \
  "select count(*) from session_v2 where time_compacting is not null;"
```
