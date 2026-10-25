// RTK OpenCode plugin — rewrites shell commands to use `rtk` for token savings.
//
// Contract: OpenCode 2 plugin API — default export { id, setup }
// (https://opencode.ai/v2/docs/build/plugins/migrate-v1).
//
// This is a thin delegating plugin: all rewrite logic lives in `rtk rewrite`,
// which is the single source of truth (src/discover/registry.rs).
// To add or change rewrite rules, edit the Rust registry — not this file.
//
// Requires: rtk >= 0.23.0 in PATH (verified against 1.0.1).
//
// Inter-plugin ordering: `caveman-native` also hooks `execute.before` and wraps
// the command as `'<node>' '<caveman>' shrink -- <original>`. Whichever plugin
// runs second sees the other's output. Registering RTK after caveman means RTK
// sees the wrapped form, which `rtk rewrite` cannot parse — it returns empty and
// the command passes through unwrapped.
//
// To stay compatible with either ordering, RTK unwraps a caveman-wrapped command
// first, rewrites the inner command, then re-wraps the result. That way the
// shell still runs through caveman's shrink (which compresses the OUTPUT) and
// the inner command gets rtk's token-optimised form.

import { execFileSync } from "node:child_process";

const RTK_BIN = "/usr/local/bin/rtk";

// Matches caveman's wrapper: '<node>' '<caveman>' shrink -- <command>
const CAVEMAN_WRAP = /^\s*(['"])(\/usr\/local\/bin\/node)\1\s+(['"])(\/usr\/local\/bin\/caveman)\3\s+shrink\s+--\s+([\s\S]+)$/;

export default {
  id: "rtk",
  async setup(ctx) {
    // Fail open: if rtk is missing the agent runs exactly as it would without it.
    try {
      execFileSync("which", ["rtk"], { stdio: "ignore", timeout: 2000 });
    } catch {
      console.warn("[rtk] rtk binary not found in PATH — plugin disabled");
      return;
    }

    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool !== "bash" && event.tool !== "shell") return;
      const command = event.input?.command;
      if (typeof command !== "string" || !command) return;

      // If caveman already wrapped the command, rewrite the inner command and
      // put the wrapper back, so both plugins' benefits survive.
      const wrapped = command.match(CAVEMAN_WRAP);
      const inner = wrapped ? wrapped[5] : command;
      const rewrap = (rewrittenInner: string) =>
        wrapped
          ? `'${wrapped[2]}' '${wrapped[4]}' shrink -- ${rewrittenInner}`
          : rewrittenInner;

      try {
        // `rtk rewrite` exit codes:
        //   0 - rewrite printed, allow rules cover every command
        //   1 - no rewrite available; run the command unchanged
        //   2 - a deny rule matched; nothing printed
        //   3 - rewrite printed, but approval must be deferred to the host
        // Exit 3 is still a successful rewrite, so a non-zero exit must not be
        // treated as failure — only 1 and 2 mean "no rewrite".
        const out = execFileSync(RTK_BIN, ["rewrite", inner], {
          encoding: "utf8",
          timeout: 2000,
          maxBuffer: 1024 * 1024,
          stdio: ["ignore", "pipe", "ignore"],
        });
        const rewritten = out.trim();
        if (rewritten && rewritten !== inner) {
          event.input.command = rewrap(rewritten);
        }
      } catch (error: any) {
        // execFileSync throws on non-zero exit. Exit 3 still carries a valid
        // rewrite on stdout, so recover it rather than dropping the rewrite.
        const code = error?.status;
        if (code === 3 && typeof error?.stdout === "string") {
          const rewritten = error.stdout.trim();
          if (rewritten && rewritten !== inner) {
            event.input.command = rewrap(rewritten);
          }
        }
        // Any other failure — pass the original command through unchanged.
      }
    });
  },
};
