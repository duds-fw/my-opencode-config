// RTK OpenCode plugin — rewrites shell commands to use `rtk` for token savings.
//
// Contract: OpenCode 2 plugin API — default export { id, setup }
// (https://opencode.ai/v2/docs/build/plugins/migrate-v1).
//
// This is a thin delegating plugin: all rewrite logic lives in `rtk rewrite`,
// which is the single source of truth (src/discover/registry.rs).
// To add or change rewrite rules, edit the Rust registry — not this file.
//
// Requires: rtk >= 0.23.0 in PATH.

import { execFileSync } from "node:child_process";

const RTK_BIN = "/usr/local/bin/rtk";

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

      try {
        const out = execFileSync(RTK_BIN, ["rewrite", command], {
          encoding: "utf8",
          timeout: 2000,
          maxBuffer: 1024 * 1024,
        });
        const rewritten = out.trim();
        if (rewritten && rewritten !== command) {
          event.input.command = rewritten;
        }
      } catch {
        // rtk rewrite failed — pass the original command through unchanged.
      }
    });
  },
};
