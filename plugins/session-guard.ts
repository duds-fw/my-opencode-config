// Session Guard — keeps long-running sessions from growing an unbounded context prefix.
//
// Root cause of the 2026-10-25 token regression (see TOKEN_SPIKE_INCIDENT.md):
// MiniMax-M3.1-Flash has a 1,000,000-token context window. Sessions grew their
// prefix to ~555k tokens without ever crossing the automatic-compaction
// threshold, so compaction never ran (0 of 114 sessions). Every one of ~1200
// turns then re-read the whole growing prefix, producing 276M cache-read
// tokens for a single session — 91% of all tokens consumed on the machine.
//
// `compaction.buffer` in opencode.jsonc lowers the automatic threshold, but it
// still only fires once the context is already large. This plugin measures the
// assembled prefix on every agent-loop request and compacts earlier, so the
// office's long-running autonomous sessions reset their prefix proactively.
//
// Measurement: the "context" hook exposes the assembled `messages` array
// ({id, role, content, metadata}) but no token counts. The prefix size is
// estimated from content length. The ratio was calibrated against real
// session telemetry (4.017 chars/token over a 599k-char prefix), so
// CHARS_PER_TOKEN = 4 is measured, not guessed.
//
// Contract: OpenCode V2 plugin API — default export { id, setup }.

const THRESHOLD_TOKENS = 150_000;
const COOLDOWN_MS = 120_000;
const CHARS_PER_TOKEN = 4;

// Guards against re-entrant compaction requests for the same session.
const pending = new Set<string>();
const lastCompaction = new Map<string, number>();

export default {
  id: "session-guard",
  async setup(ctx) {
    // "context" runs for the agent loop, including tool-driven continuations.
    // This is the point where the outgoing prefix size is known.
    await ctx.session.hook("context", async (event) => {
      const sessionID = event.sessionID;
      if (!sessionID) return;
      if (pending.has(sessionID)) return;

      const now = Date.now();
      if (now - (lastCompaction.get(sessionID) ?? 0) < COOLDOWN_MS) return;

      const estimated = estimateTokens(event.messages);
      if (estimated < THRESHOLD_TOKENS) return;

      pending.add(sessionID);
      try {
        await ctx.session.compact({ sessionID });
        lastCompaction.set(sessionID, now);
        console.log(
          `[session-guard] compacted ${sessionID} at ~${estimated.toLocaleString()} tokens`
        );
      } catch (error) {
        console.warn(`[session-guard] compaction failed for ${sessionID}: ${error}`);
      } finally {
        pending.delete(sessionID);
      }
    });
  },
};

function estimateTokens(messages: unknown): number {
  if (!Array.isArray(messages)) return 0;
  let characters = 0;
  for (const message of messages) {
    characters += contentLength(message);
  }
  return Math.ceil(characters / CHARS_PER_TOKEN);
}

function contentLength(message: unknown): number {
  const content = (message as { content?: unknown })?.content;
  if (typeof content === "string") return content.length;
  if (content === undefined || content === null) return 0;
  try {
    return JSON.stringify(content).length;
  } catch {
    return 0;
  }
}
