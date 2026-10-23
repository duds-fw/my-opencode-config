/* Pixel Agents - OpenCode plugin. Auto-loaded by opencode from ~/.config/opencode/plugins/ */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/src/providers/hook/opencode/plugins/opencode-plugin.ts
var opencode_plugin_exports = {};
__export(opencode_plugin_exports, {
  PixelAgentsOpenCode: () => PixelAgentsOpenCode,
  default: () => opencode_plugin_default
});
module.exports = __toCommonJS(opencode_plugin_exports);
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var DEBUG_LOG = process.env.PIXEL_AGENTS_DEBUG_LOG;
var HOOK_API_PATH = "/api/hooks/opencode";
var SERVER_JSON = path.join(os.homedir(), ".pixel-agents", "server.json");
var SERVERS_REGISTRY_DIR = path.join(os.homedir(), ".pixel-agents", "servers");
function hookDebug(message) {
  if (!DEBUG_LOG) return;
  try {
    fs.appendFileSync(DEBUG_LOG, `[opencode-plugin] ${message}
`);
  } catch {
  }
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
  return void 0;
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
    post(server, payload).catch(() => void 0);
  }
}
function sessionIdFrom(properties) {
  const p = properties ?? {};
  const info = p.info;
  const value = p.sessionID ?? info?.id ?? p.id;
  return typeof value === "string" ? value : void 0;
}
function directoryFrom(properties) {
  const p = properties ?? {};
  const info = p.info;
  const value = p.directory ?? info?.directory ?? p.cwd;
  return typeof value === "string" ? value : void 0;
}
var PixelAgentsOpenCode = async (ctx) => {
  hookDebug("plugin loaded");
  const fallbackDirectory = ctx.directory ?? ctx.worktree;
  return {
    /** session lifecycle: created -> SessionStart, idle -> Stop, deleted -> SessionEnd */
    event: async (input) => {
      const event = input.event ?? {};
      const properties = event.properties ?? {};
      const sessionId = sessionIdFrom(properties) ?? (typeof event.sessionID === "string" ? event.sessionID : void 0);
      const cwd = directoryFrom(properties) ?? fallbackDirectory;
      switch (event.type) {
        case "session.created": {
          const info = properties.info;
          const title = typeof info?.title === "string" ? info.title : void 0;
          broadcast({
            hook_event_name: "SessionStart",
            session_id: sessionId,
            ...cwd ? { cwd } : {},
            ...title ? { title } : {},
            source: "session.created"
          });
          break;
        }
        case "session.idle":
          if (sessionId) {
            broadcast({ hook_event_name: "Stop", session_id: sessionId, source: "session.idle" });
          }
          break;
        case "session.deleted":
          if (sessionId) {
            broadcast({ hook_event_name: "SessionEnd", session_id: sessionId, reason: "exit", source: "session.deleted" });
          }
          break;
        default:
          break;
      }
    },
    /** PreToolUse: tool about to run. output.args is the resolved tool input. */
    "tool.execute.before": async (input, output) => {
      if (!input.sessionID) return;
      broadcast({
        hook_event_name: "PreToolUse",
        session_id: input.sessionID,
        tool_name: input.tool,
        tool_input: output?.args ?? {},
        source: "tool.execute.before"
      });
    },
    /** PostToolUse: tool finished. */
    "tool.execute.after": async (input) => {
      if (!input.sessionID) return;
      broadcast({
        hook_event_name: "PostToolUse",
        session_id: input.sessionID,
        tool_name: input.tool,
        source: "tool.execute.after"
      });
    },
    /** PermissionRequest: agent is waiting for a permission decision. */
    "permission.ask": async (input) => {
      if (!input.sessionID) return;
      broadcast({
        hook_event_name: "PermissionRequest",
        session_id: input.sessionID,
        source: "permission.ask"
      });
    }
  };
};
var opencode_plugin_default = PixelAgentsOpenCode;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PixelAgentsOpenCode
});
