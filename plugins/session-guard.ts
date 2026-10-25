// Session Guard — keeps long-running sessions from growing an unbounded context prefix.
//
// Root cause of the 2026-10-25 token regression (see TOKEN_SPIKE_INCIDENT.md):
// MiniMax-M3.1-Flash has a 1,000,000-token context window. Sessions grew their
// prefix to ~555k tokens without ever crossing the automatic-compaction
// threshold, so compaction never ran (0 of 114 sessions). Every one of ~1200
// turns then re-read the whole growing prefix, producing 351M cache-read
// tokens for a single session — 91% of all tokens consumed on the machine.
//
// `compaction.buffer` in opencode.jsonc lowers the automatic threshold, but it
// still only fires once the context is already large, and only for the model
// whose limit is known. This plugin compacts earlier, so the office's
// long-running autonomous sessions reset their prefix proactively.
//
// Measurement: the "context" hook's `event.messages` contains only the
// messages added since the previous agent-loop iteration (1-8 entries), NOT the
// full prefix — so it cannot be used to size the context. The real prefix size
// is `ctx.session.context({ sessionID })`, which returns the whole session
// history; each assistant message in it carries the provider's token accounting
// for the turn that produced it.
//
// The prefix size for a turn is `tokens.input + tokens.cache.read`: the
// provider splits the outgoing prefix between the uncached part (`input`) and
// the cache-hit part (`cache.read`). Either can carry the bulk depending on
// cache state — a prefix that was a cache miss reports a large `input` with
// `cache.read` pinned at ~128, and a cache hit reports the reverse. Taking
// only `cache.read` would miss the former, so both are summed.
//
// These are real provider tokens — no character-count estimation required.
//
// Contract: OpenCode V2 plugin API — default export { id, setup }.

import { appendFileSync } from "node:fs";

const THRESHOLD_TOKENS = 150_000;
const COOLDOWN_MS = 120_000;
const LOG_PATH = "/tmp/opencode/session-guard.log";

// Guards against re-entrant compaction requests for the same session.
const pending = new Set<string>();
const lastCompaction = new Map<string, number>();

function log(message: string): void {
  try {
    appendFileSync(LOG_PATH, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging must never break the agent loop.
  }
}

export default {
  id: "session-guard",
  async setup(ctx: any) {
    // "context" runs for the agent loop, including tool-driven continuations.
    // This is the point where the outgoing prefix size is known.
    await ctx.session.hook("context", async (event: any) => {
      const sessionID = event.sessionID;
      if (!sessionID) return;
      if (pending.has(sessionID)) return;

      const now = Date.now();
      if (now - (lastCompaction.get(sessionID) ?? 0) < COOLDOWN_MS) return;

      let prefixTokens: number;
      try {
        const history = await ctx.session.context({ sessionID });
        if (!Array.isArray(history) || history.length === 0) return;

        // The newest assistant message reports the size of the prefix that was
        // sent for that turn. That is the current context size.
        let latest = 0;
        for (const message of history) {
          const tokens = (message as any)?.tokens;
          if (!tokens) continue;
          const prefix = (tokens.input ?? 0) + (tokens.cache?.read ?? 0);
          if (prefix > latest) latest = prefix;
        }
        prefixTokens = latest;
      } catch (error) {
        log(`prefix measurement failed for ${sessionID}: ${error}`);
        return;
      }

      if (prefixTokens < THRESHOLD_TOKENS) return;

      pending.add(sessionID);
      try {
        await ctx.session.compact({ sessionID });
        lastCompaction.set(sessionID, now);
        log(`compacted ${sessionID} at ${prefixTokens.toLocaleString()} tokens`);
      } catch (error) {
        log(`compaction failed for ${sessionID}: ${error}`);
      } finally {
        pending.delete(sessionID);
      }
    });

    log("session-guard registered");
  },
};
