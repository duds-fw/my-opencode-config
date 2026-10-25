/* Pixel Agents - OpenCode plugin. Auto-loaded by opencode from ~/.config/opencode/plugins/ */
//
// Contract: OpenCode 2 plugin API — default export { id, setup }
// (https://opencode.ai/v2/docs/build/plugins/migrate-v1).
//
// Broadcasts session lifecycle and tool events to any running Pixel Agents
// server. If no server is registered this is a no-op.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEBUG_LOG = process.env.PIXEL_AGENTS_DEBUG_LOG;
const HOOK_API_PATH = "/api/hooks/opencode";
const SERVER_JSON = path.join(os.homedir(), ".pixel-agents", "server.json");
const SERVERS_REGISTRY_DIR = path.join(os.homedir(), ".pixel-agents", "servers");

function hookDebug(message) {
  if (!DEBUG_LOG) return;
  try {
    fs.appendFileSync(DEBUG_LOG, `[opencode-plugin] ${message}\n`);
  } catch {}
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function serverUrlFrom(data) {
  if (typeof data.url === "string" && data.url.length > 0) return data.url;
  if (typeof data.host === "string" && data.host.length > 0) return data.host;
  if (typeof data.port === "number" && Number.isSafeInteger(data.port) && data.port > 0) {
    return `http://127.0.0.1:${data.port}`;
  }
  return undefined;
}

function discoverServers() {
  const servers = [];
  try {
    if (fs.existsSync(SERVERS_REGISTRY_DIR)) {
      for (const file of fs.readdirSync(SERVERS_REGISTRY_DIR)) {
        if (!file.endsWith(".json")) continue;
        try {
          const data = JSON.parse(fs.readFileSync(path.join(SERVERS_REGISTRY_DIR, file), "utf-8"));
          if (typeof data.pid === "number" && !isProcessAlive(data.pid)) continue;
          const url = serverUrlFrom(data);
          if (!url) continue;
          servers.push({ url, token: data.authToken ?? data.token });
        } catch (e) {
          hookDebug(`skipping bad registry file ${file}: ${String(e)}`);
        }
      }
    }
    if (servers.length === 0 && fs.existsSync(SERVER_JSON)) {
      const data = JSON.parse(fs.readFileSync(SERVER_JSON, "utf-8"));
      const url = serverUrlFrom(data);
      if (url) servers.push({ url, token: data.authToken ?? data.token });
    }
  } catch (e) {
    hookDebug(`discover failed: ${String(e)}`);
  }
  return servers;
}

async function post(server, payload) {
  const url = `${server.url.replace(/\/+$/, "")}${HOOK_API_PATH}`;
  const headers = { "content-type": "application/json" };
  if (server.token) headers.authorization = `Bearer ${server.token}`;
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!res.ok) hookDebug(`POST ${url} -> ${res.status}`);
  } catch (e) {
    hookDebug(`POST ${url} failed: ${String(e)}`);
  }
}

function broadcast(payload) {
  for (const server of discoverServers()) {
    post(server, payload).catch(() => {});
  }
}

export default {
  id: "pixel-agents",
  async setup(ctx) {
    hookDebug("plugin loaded");
    const controller = new AbortController();
    const fallbackDirectory = ctx.location?.directory;

    // Session lifecycle: created -> SessionStart, idle -> Stop, deleted -> SessionEnd
    void (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        const data = event.data ?? {};
        const sessionId = data.sessionID ?? data.info?.id;
        if (typeof sessionId !== "string" || !sessionId) continue;
        const cwd = data.directory ?? data.info?.directory ?? fallbackDirectory;

        if (event.type === "session.created") {
          const title = data.info?.title ?? data.title;
          broadcast({
            hook_event_name: "SessionStart",
            session_id: sessionId,
            ...(cwd ? { cwd } : {}),
            ...(typeof title === "string" ? { title } : {}),
            source: "session.created",
          });
        } else if (event.type === "session.idle") {
          broadcast({ hook_event_name: "Stop", session_id: sessionId, source: "session.idle" });
        } else if (event.type === "session.deleted") {
          broadcast({ hook_event_name: "SessionEnd", session_id: sessionId, reason: "exit", source: "session.deleted" });
        }
      }
    })().catch(() => {
      if (!controller.signal.aborted) hookDebug("event subscription failed");
    });

    // PreToolUse: tool about to run.
    await ctx.tool.hook("execute.before", (event) => {
      if (!event.sessionID) return;
      broadcast({
        hook_event_name: "PreToolUse",
        session_id: event.sessionID,
        tool_name: event.tool,
        tool_input: event.input ?? {},
        source: "tool.execute.before",
      });
    });

    // PostToolUse: tool finished.
    await ctx.tool.hook("execute.after", (event) => {
      if (!event.sessionID) return;
      broadcast({
        hook_event_name: "PostToolUse",
        session_id: event.sessionID,
        tool_name: event.tool,
        source: "tool.execute.after",
      });
    });

    // PermissionRequest: agent is waiting for a permission decision.
    await ctx.permission.hook("evaluate", (event) => {
      if (!event.sessionID) return;
      broadcast({
        hook_event_name: "PermissionRequest",
        session_id: event.sessionID,
        source: "permission.ask",
      });
    });

    return () => controller.abort();
  },
};
