# OpenCode Machine Capability Map & Full Duplication Runbook

> **Sumber**: analisis menyeluruh machine A (mesin ini).
> **Tujuan**: dokumen lengkap untuk menyalin SEMUA capability opencode ke machine B.
> **Tanggal**: 2026-09-29  (opencode v1.18.18)

---

## PART I — ANALISIS CAPABILITY (Machine A)

### 1. Stack & Versi Kunci

| Komponen | Versi | Lokasi |
|---|---|---|
| OS | Ubuntu 24.04.4 LTS | — |
| Node.js | v20.20.2 | `/usr/local/bin/node` |
| opencode (CLI) | **1.18.18** | `/usr/local/bin/opencode` → `npm -g opencode-ai@1.18.18` |
| Plugin SDK | @opencode-ai/plugin **1.18.5** | `~/.config/opencode/node_modules` |
| rtk (token-saving CLI) | **0.42.4** | `/usr/local/bin/rtk` → `/root/.cargo/bin/rtk` (via cargo) |
| graphify (knowledge graph) | **0.9.26** | `/usr/local/bin/graphify` → uv tool `/root/.local/bin/graphify` |
| opencode-synced (config sync) | 0.9.0 | `~/.config/opencode/node_modules/opencode-synced` |

**Binary hardening di machine A** (penting untuk duplikasi):
- `/usr/bin/curl` → **di-rename jadi `/usr/bin/rcurl`** (dpkg tetap mencatat terinstall; `dpkg --verify curl` = "missing").
- `/usr/bin/wget` → **di-rename jadi `/usr/bin/rwget`**.
- Semua script/proxy di machine A WAJIB pakai `rcurl`, bukan `curl`.
- Tidak ada `curl`/`wget` standard — library/download via `node fetch`, `rtk`, `npx`.

### 2. Struktur Konfigurasi Global (`~/.config/opencode/`)

```
~/.config/opencode/
├── agent/                       # 7 agent definitions (markdown front-matter)
│   ├── orchestrator.md          # mode: primary (default_agent), 100 steps
│   ├── code-reviewer.md, debugger.md, architect.md, tester.md,
│   │   documenter.md, devops.md, security-auditor.md, plan.md, chloe-skills.md
├── plugins/                     # 3 plugin file
│   ├── graphify.js              # reminder → inject echo "[graphify] ..." sebelum bash
│   ├── opencode-plugin.js       # Pixel Agents bridge → POST /api/hooks/opencode
│   └── rtk.ts                   # auto-rewrite command pakai `rtk rewrite` (hemat token)
├── skills/
│   └── graphify/                # skill knowledge graph lengkap
│       ├── SKILL.md (39 KB) + 8 references/ + .graphify_version=0.9.26
├── opencode.jsonc               # konfigurasi utama global (lihat Part II)
├── package.json / package-lock.json
├── opencode-synced.jsonc        # sync repo duds-fw/my-opencode-config
└── tui.json                     # keybinds: input_submit=ctrl+return, input_newline=return
```

**Agent global**: `orchestrator` (primary), `code-reviewer`, `debugger`, `architect`, `tester`, `documenter`, `devops`, `security-auditor`, `plan`, `chloe-skills` (subagents).

**Plugin global terdaftar di opencode.jsonc**: `"opencode-synced"` (npm) + `"./.opencode/plugins/graphify.js"` (lokal). Plugin di folder `plugins/` diload otomatis: graphify.js, opencode-plugin.js (Pixel Agents), rtk.ts.

### 3. MCP Servers (global, `mcp:` di opencode.jsonc)

| Nama | Type | Command / URL | Enabled |
|---|---|---|---|
| filesystem | local | `/usr/local/bin/mcp-server-filesystem /home/projects /home/eirene` | ✅ |
| git | local | `/usr/local/bin/mcp-server-git --repository /home/projects /home/eirene/eirene-master` | ✅ |
| memory | local | `/usr/local/bin/mcp-server-memory` | ✅ |
| sequential-thinking | local | `/usr/local/bin/mcp-server-sequential-thinking` | ❌ |
| browser | local | `/usr/local/bin/npx -y @playwright/mcp` | ❌ |
| android | local | `android-mcp-server` | ❌ |
| docker | local | `/usr/local/bin/npx -y mcp-docker-server` | ❌ |
| ssh | local | `/usr/local/bin/ssh-mcp --host=127.0.0.1 --user=root --disableSudo` | ❌ |
| database | local | `/usr/local/bin/npx -y @cocaxcode/database-mcp` | ❌ |
| context7 | remote | `https://mcp.context7.com/mcp` | ❌ |
| deepwiki | remote | `https://mcp.deepwiki.com/mcp` | ❌ |

### 4. Command (custom slash commands, `command:`)

13 command global: `review`, `explain`, `refactor`, `test`, `security`, `optimize`, `graphify`, `graphify-query`, `graphify-update`, `rtk-discover`, `restart` (→ `/opt/opencode-proxy/restart.sh`), `assess` (chloe-skills), `role-info`.

### 5. Permission Model (global)

- `edit: allow`
- `bash`: allow (`git*`, `npm*`, `npx*`, `node*`, `rtk*`, `ls*`, `cat*`, `mkdir*`, `cp*`, `echo*`, `export*`, `ps*`, `tail*`, `head*`, `find*`, `grep*`, `sudo gh *`, `sudo /opt/*`, `ssh-keyscan *`, `nohup *`, `wait *`); **ask** (`kill*`, `curl*`, `wget*`, `*`); **deny** (`rm*`, `rm -rf *`, `sudo rm *`, `chmod 777 *`)
- `external_directory`: allow `/home/eirene/**`, `/home/projects/**`, `/root/.config/opencode/**`, `/tmp/opencode/**`, sisanya ask.

### 6. Instructions Global

- `AGENTS.md` (dari WorkingDirectory `/home/projects/AGENTS.md` — "AI Agent Constitution Lite")
- `.opencode/instructions/*.md` (mis. `project-structure.md` di project)

### 7. Project-Level Config (per project)

| Project | File Config | Agent | Skills | Plugins |
|---|---|---|---|---|
| `/home/projects` | `opencode.jsonc` + `./.opencode/` | build, code-reviewer, debugger, architect | `./.opencode/skills/` (code-quality, scaffold) | `./.opencode/plugins/graphify.js` |
| `/home/eirene` | `opencode.jsonc` (references 9 paths) + `AGENTS.md` | scrum-po, scrum-sm, scrum-dev, scrum-qa (di `.opencode/agent/`) | `.opencode/skills/` (background-bash, sandbox-rules) | opencode-synced, `./.opencode/plugins/graphify.js` |

Project /home/projects juga punya `.opencode/` dengan opencode.json (plugin graphify.js), skills code-quality + scaffold.

### 8. Infrastruktur Services (systemd)

| Service | Deskripsi | Port | Perintah |
|---|---|---|---|
| `opencode.service` | opencode web aktif | 0.0.0.0:4097 | `opencode web --hostname 0.0.0.0 --port 4097` |
| `opencode2.service` | standby (127.0.0.1) | 127.0.0.1:4098 | `opencode web --hostname 127.0.0.1 --port 4098` |
| `opencode-proxy.service` | reverse proxy + blue-green failover | 0.0.0.0:4096 | `node /opt/opencode-proxy/server.mjs` |
| `pixel-agents.service` | Pixel Agents (karakter/agents dunia) | 0.0.0.0:3100 | `node dist/cli.js --port 3100 --host 0.0.0.0` |
| `ai-dashboard.service` | dashboard pemakaian AI | 0.0.0.0:8080 | `node server.js` |

Env service: `OPENCODE_SERVER_PASSWORD=__OPENCODE_PASSWORD__`, `OPENCODE_YOLO=true`, `PATH=/usr/local/bin:/usr/bin:/bin:/root/.cargo/bin`, `WorkingDirectory=/home/projects`, `Restart=always`.

### 9. Pixel Agents Bridge

- Repo: `/home/projects/pixel-agents` (v1.4.0) — mode `standalone` + `watchAllSessions: true`.
- Global plugin diload dari build: `~/.config/opencode/plugins/opencode-plugin.js` (binari hasil `tsc` → plugin ES2022). Menulis ke `~/.pixel-agents/server.json` (token per-server, PID, startAt).
- Webhook: `POST /api/hooks/opencode` → `server.json` (port 3100, token).
- Extra hooks: `~/.pixel-agents/hooks/claude-hook.js` (untuk Claude provider).
- Registry: `~/.pixel-agents/servers/<pid>-3100.json`.
- UI: PWA di `/opt/opencode-proxy/` (wrapper.html "Chloe", manifest.json, sw.js, icons).

### 10. State & Sync

- DB sesi/snapshot: `~/.local/share/opencode/opencode.db` (SQLite, 898 MB), `auth.json` (4 provider: github-copilot, openrouter, opencode, opencode-go).
- Config sync via npm `opencode-synced` → GitHub `duds-fw/my-opencode-config` (auto push/pull agent + opencode.jsonc; includeSecrets=false).
- Bash aliases di `~/.bashrc`: `rk`=rtk, `rkg`=rtk graphify, `gph`=graphify, `gphq`=graphify query, `gphu`=graphify update, git aliases, `proj`=cd /home/projects. PATH include `/root/.cargo/bin` & `/root/.local/bin`. `export HOME=/root` (fix untuk opencode shell session).
- Model favorit: `{"recent":[],"favorite":[],"variant":{"openrouter/google/gemini-3-pro-image-preview":"default"}}`.

---

## PART II — PROMPT DUPLIKASI KE MACHINE B

Prompt di bawah ini SIAP TEMPEL pada machine B (mis. di `opencode` agent atau sesi baru) untuk replikasi penuh. Ganti `BUILD_USER` dan secret sesuai environment baru.

```markdown
# TUGAS: Replikasi penuh setup OpenCode dari machine A ke mesin ini (machine B)

> Kamu adalah DEVOPS engineer. Ikuti semua langkah HARFIAH, verifikasi tiap langkah,
> dan JANGAN skip. Sebagian langkah memerlukan sudo (jalankan `sudo` saat diminta).
> Catat setiap penyimpangan.

## 0) PRA-SYARAT
- Pastikan pengguna running punya sudo tanpa password: `sudo -n true`
- Node.js v20+ (`node --version`). Jika belum: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs` — TAPI mesin A memakai rename curl→rcurl; di machine B pakai tool yang tersedia (wget/curl/npx).
- Git tersedia.

## 1) INSTALL BINARY CORE
1. `sudo npm install -g opencode-ai@1.18.18`  # dapatkan /usr/local/bin/opencode
2. `npm install -g @modelcontextprotocol/server-filesystem @modelcontextprotocol/server-memory @modelcontextprotocol/server-sequential-thinking`
3. `npm install -g @gitkraken/gk`             # git MCP + git_issues_* / git_pull_request_*
4. `npm install -g @cocaxcode/database-mcp mcp-docker-server ssh-mcp android-mcp-server playwright`
5. Install rtk: `cargo install rtk` atau binary dari release (v0.42.4) → `/usr/local/bin/rtk`
6. Install graphify: `uv tool install graphify@0.9.26` dan `uv tool install mcp-server-git`  # symlink ke /usr/local/bin
7. SASRAN: pastikan `opencode --version` = 1.18.18, `node --version` >= 20, `rtk --version` berjalan.
8. (Opsional hardening, mengikuti mesin A) rename curl & wget:
   `sudo mv /usr/bin/curl /usr/bin/rcurl && sudo mv /usr/bin/wget /usr/bin/rwget`
   - Semua script LOKAL yang dipakai harus memakai rcurl (lihat restart.sh).

## 2) BUAT FOLDER & DIREKTORI KERJA
```
sudo mkdir -p /home/projects /home/eirene /opt/opencode-proxy /root/.config/opencode
```

## 3) TULIS KONFIGURASI GLOBAL ~/.config/opencode/
### 3a. opencode.jsonc
Salin isi persis dari Part III (Di Bawah). Simpan sebagai `$HOME/.config/opencode/opencode.jsonc`.

### 3b. package.json & plugin deps
```json
{ "dependencies": { "@opencode-ai/plugin": "1.18.5", "opencode-synced": "^0.9.0" } }
```
Lalu `cd ~/.config/opencode && npm install`

### 3c. Agent definitions
Buat 10 file markdown di `$HOME/.config/opencode/agent/`:
- orchestrator.md (mode primary), code-reviewer.md, debugger.md, architect.md,
  tester.md, documenter.md, devops.md, security-auditor.md, plan.md, chloe-skills.md
Isi minimal sama seperti yang didefinisikan di opencode.jsonc (description, mode,
permission, steps). Untuk performa sama persis: salin konten markdown penuh dari machine A
(`scp root@<A>:~/.config/opencode/agent/*.md ~/.config/opencode/agent/`).

### 3d. Plugins (wajib ada 3 file)
1. `plugins/graphify.js` — plugin reminder graphify (lihat Part III untuk konten).
2. `plugins/opencode-plugin.js` — Pixel Agents bridge; SALIN dari machine A
   `~/.config/opencode/plugins/opencode-plugin.js` (file hasil build ini bergantung
   pada `~/pixel-agents` source, lihat §8).
3. `plugins/rtk.ts` — rewrite via `rtk rewrite`.

### 3e. Skills
- Salin folder `skills/graphify/` penuh dari machine A (SKILL.md + references/).
  Pastikan `graphify` binary terpasang (langkah 1.6) agar skill berfungsi.
- (Optional) skills project: code-quality, scaffold (lihat Part III).

### 3f. tui.json + opencode-synced.jsonc
```
tui.json:            { "$schema":"https://opencode.ai/tui.json", "keybinds":{ "input_submit":"ctrl+return","input_newline":"return,shift+return,alt+return,ctrl+j" } }
opencode-synced.jsonc:  sync repo duds-fw/my-opencode-config (ganti sesuai repo kamu)
```

## 4) SETUP INSTRUKSI PROJECT
- `/home/projects/AGENTS.md`  = AI Agent Constitution Lite (lihat Part III)
- `/home/projects/opencode.jsonc` = project config (lihat Part III)
- `/home/projects/.opencode/opencode.json`, `plugins/graphify.js`,
  `skills/code-quality/SKILL.md`, `skills/scaffold/SKILL.md`,
  `instructions/project-structure.md`
- `/home/eirene/AGENTS.md`, `opencode.jsonc`, `.opencode/agent/scrum-*.md`,
  `.opencode/skills/background-bash/`, `.opencode/skills/sandbox-rules/`

## 5) SETUP SERVICES (systemd)
Buat unit di `/etc/systemd/system/`:
- opencode.service (0.0.0.0:4097, WORKDIR /home/projects, OPENCODE_SERVER_PASSWORD ganti!, OPENCODE_YOLO=true, Restart=always)
- opencode2.service (127.0.0.1:4098, sama)
- opencode-proxy.service (node /opt/opencode-proxy/server.mjs)
- pixel-agents.service (node /home/projects/pixel-agents/dist/cli.js --port 3100)
- ai-dashboard.service (node /home/projects/ai-dashboard/server.js)
Lalu: `sudo systemctl daemon-reload && sudo systemctl enable --now <service>`

## 6) SETUP BLUE-GREEN PROXY (/opt/opencode-proxy)
1. `npm init -y && npm install http-proxy` 
2. Salin dari machine A: `server.mjs`, `config.json`, `restart.sh`, `wrapper.html`, `manifest.json`, `sw.js`, `icons/*`. 
   PATIKAN: restart.sh memakai **rcurl** (bukan curl) — mesin A sudah pakai rcurl.
3. `config.json`: `{ "activePort": 4097, "standbyPort": 4098 }`
4. Test: `bash -n restart.sh`; lalu `sudo systemctl start opencode-proxy`.

## 7) AUTH & PROVIDERS
- `~/.local/share/opencode/auth.json`: daftar provider machine A = github-copilot,
  openrouter, opencode, opencode-go. Di machine B isi token/provider kamu sendiri
  (JANGAN salin token machine A untuk remote provider — secret di-regenerate).
- Model terverifikasi jalan untuk sub-agent sesi: `openrouter/~deepseek/deepseek-v4-flash-latest`
  (default google/gemini-3-pro-image-preview = tanpa tool-use endpoint; opencode/ native
  butuh billing; github-copilot terbatas quota).

## 8) PIXEL AGENTS (optional tapi di mesin A aktif)
```
git clone https://github.com/<owner>/pixel-agents /home/projects/pixel-agents
cd /home/projects/pixel-agents && npm install && npm run build   # hasil: dist/cli.js
# plugin global sudah dikopi dari ~/.config/opencode/plugins/opencode-plugin.js (build dari server/src/providers/hook/opencode/)
```
-TES: `node dist/cli.js --port 3100 --host 0.0.0.0` (standalone). Harus respon 200 di / .
- `~/.pixel-agents/config.json` (standalone watchAllSessions=true, hooksEnabled=true)

## 9) .bashrc (env)
Tambahkan: PATH cargo/local/bin, alias rk/rkg/gph/gphq/gphu + git aliases + proj,
`export HOME=/root` (fix opencode shell).

## 10) VERIFIKASI AKHIR (WAJIB)
1. `opencode --version` → 1.18.18
2. `opencode web --hostname 127.0.0.1 --port 4097` → health `rcurl -sf ... http://127.0.0.1:4097/`
3. Proxy 4096 → 200; failover: matikan 4097 → 4096 masih 200 (diarahkan ke 4098)
4. `opencode run --model openrouter/~deepseek/deepseek-v4-flash-latest "test agent"` → sesi berjalan
5. `rtk rewrite "ls -la"` → output ter-rewrite (hemat token)
6. `graphify query "test"` → graphify merespons
7. Pixel Agents: `GET http://127.0.0.1:3100/` → 200; server.json terisi; agent muncul di standalone.

## 11) PELAPORAN
Keluar dengan laporan: versi komponen, health semua port (4096/4097/4098/3100/8080),
daftar agent/skill/plugin/MCP yang aktif, dan catatan penyimpangan dari spesifikasi.
```

---

## PART III — ISI FILE KUNCI (untuk replikasi file)

### 3a. `~/.config/opencode/opencode.jsonc` (global — esensial)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  "mcp": {
    "filesystem":      { "type": "local", "command": ["/usr/local/bin/mcp-server-filesystem", "/home/projects", "/home/eirene"], "enabled": true, "timeout": 10000 },
    "git":             { "type": "local", "command": ["/usr/local/bin/mcp-server-git", "--repository", "/home/projects", "/home/eirene/eirene-master"], "enabled": true, "timeout": 30000 },
    "memory":          { "type": "local", "command": ["/usr/local/bin/mcp-server-memory"], "enabled": true, "timeout": 10000 },
    "sequential-thinking": { "type": "local", "command": ["/usr/local/bin/mcp-server-sequential-thinking"], "enabled": false, "timeout": 15000 },
    "browser":         { "type": "local", "command": ["/usr/local/bin/npx", "-y", "@playwright/mcp"], "enabled": false, "timeout": 30000 },
    "android":         { "type": "local", "command": ["android-mcp-server"], "enabled": false, "timeout": 30000 },
    "docker":          { "type": "local", "command": ["/usr/local/bin/npx", "-y", "mcp-docker-server"], "enabled": false, "timeout": 30000 },
    "ssh":             { "type": "local", "command": ["/usr/local/bin/ssh-mcp", "--host=127.0.0.1", "--user=root", "--disableSudo"], "enabled": false, "timeout": 30000 },
    "database":        { "type": "local", "command": ["/usr/local/bin/npx", "-y", "@cocaxcode/database-mcp"], "enabled": false, "timeout": 30000 },
    "context7":        { "type": "remote", "url": "https://mcp.context7.com/mcp", "enabled": false, "timeout": 30000 },
    "deepwiki":        { "type": "remote", "url": "https://mcp.deepwiki.com/mcp", "enabled": false, "timeout": 30000 }
  },

  "default_agent": "orchestrator",

  "agent": {
    "build":        { "permission": "allow", "steps": 30 },
    "orchestrator": {
      "description": "Auto-pilot orchestrator. Classifies user requests and routes to the best specialist agent automatically. Enforces plan mode for multi-step tasks.",
      "mode": "primary",
      "permission": {
        "edit": "allow",
        "bash": { "git *": "allow", "npm *": "allow", "npx *": "allow", "rtk *": "allow", "mkdir *": "allow", "ls *": "allow", "cat *": "allow", "echo *": "allow", "export *": "allow", "docker build*": "allow", "terraform *": "ask", "kubectl *": "ask", "rm *": "deny", "*": "ask" },
        "task": "allow", "read": "allow", "glob": "allow", "grep": "allow"
      },
      "steps": 60
    },
    "code-reviewer":  { "description": "Reviews code for quality, security, and best practices. Use when reviewing PRs or checking code quality.", "mode": "subagent", "permission": "allow", "steps": 30 },
    "debugger":       { "description": "Helps debug issues by analyzing errors and suggesting fixes. Use when encountering bugs or errors.", "mode": "subagent", "permission": "allow", "steps": 30 },
    "architect":      { "description": "Designs system architecture and plans. Use for architectural decisions and system design.", "mode": "subagent", "permission": "allow", "steps": 30 },
    "tester":         { "description": "Testing specialist. Generates, improves, and analyzes tests.", "mode": "subagent", "permission": "allow", "steps": 30 },
    "documenter":     { "description": "Documentation specialist.", "mode": "subagent", "permission": "allow", "steps": 30 },
    "devops":         { "description": "DevOps specialist. Handles CI/CD, Docker, Kubernetes, deployment, and infrastructure.", "mode": "subagent", "permission": "allow", "steps": 30 },
    "security-auditor": { "description": "Security specialist. Performs security audits, vulnerability scanning, and dependency checks.", "mode": "subagent", "permission": "allow", "steps": 30 },
    "chloe-skills":   { "description": "IT Organization capability planning. Assesses role readiness and creates 30/60/90 learning plans for 15 IT roles.", "mode": "subagent", "permission": "allow", "steps": 30 },
    "plan":           { "description": "Plan agent. Creates structured execution plans for multi-step tasks.", "mode": "subagent", "permission": { "edit": "deny", "bash": "deny", "read": "allow", "glob": "allow", "grep": "allow", "task": "allow" }, "steps": 50 }
  },

  "command": {
    "review":    { "description": "Review staged changes for issues", "template": "Review the staged changes (git diff --cached) for:\n1. Security vulnerabilities\n2. Performance issues\n3. Code quality\n4. Best practices\n\nProvide a summary with specific issues and suggestions." },
    "explain":   { "description": "Explain how a file or module works", "template": "Explain how $ARGUMENTS works. Break down:\n1. Purpose and responsibility\n2. Key functions/components\n3. Data flow\n4. Dependencies\n5. Edge cases" },
    "refactor":  { "description": "Suggest refactoring improvements", "template": "Analyze $ARGUMENTS and suggest refactoring improvements:\n1. Code smells\n2. Duplication\n3. Complexity\n4. Naming\n5. Structure\n\nProvide specific, actionable suggestions." },
    "test":      { "description": "Generate or improve tests", "template": "Analyze $ARGUMENTS and suggest test improvements:\n1. Missing test cases\n2. Edge cases to cover\n3. Mocking strategies\n4. Test organization\n5. Assertions to add" },
    "security":  { "description": "Security audit of code", "template": "Perform a security audit of $ARGUMENTS:\n1. Input validation\n2. Authentication/Authorization\n3. Data exposure\n4. Injection vulnerabilities\n5. Dependency vulnerabilities\n6. Secrets management" },
    "optimize":  { "description": "Performance optimization suggestions", "template": "Analyze $ARGUMENTS for performance:\n1. Time complexity\n2. Space complexity\n3. I/O operations\n4. Caching opportunities\n5. Parallelization potential\n6. Memory efficiency" },
    "graphify":  { "description": "Build knowledge graph from codebase", "template": "Run graphify on the project to build a knowledge graph. Use --code-only for local extraction without API keys." },
    "graphify-query":  { "description": "Query the knowledge graph", "template": "Query the knowledge graph: graphify query $ARGUMENTS" },
    "graphify-update": { "description": "Update the knowledge graph", "template": "Update the knowledge graph with recent changes: graphify update ." },
    "rtk-discover":    { "description": "Discover RTK savings opportunities", "template": "Run rtk discover to find token savings opportunities" },
    "restart":         { "description": "Blue-green restart opencode (zero downtime)", "template": "sudo /opt/opencode-proxy/restart.sh" },
    "assess":    { "description": "Assess IT role capability and create learning plan", "template": "Assess the following role and create a 30/60/90 day learning plan:\n- Role: $ARGUMENTS\n- Current level: beginner/intermediate/advanced\n- Business goal: [describe]\n- Timeline: 90 days\n- Constraints: [list]\n\nUse chloe-skills agent for structured output." },
    "role-info": { "description": "Get role information from skills matrix", "template": "Search Memory MCP for role-$ARGUMENTS and provide:\n1. Core skills\n2. Tools\n3. Learning path\n4. Rubric capabilities\n5. Roadmap links" }
  },

  "instructions": ["AGENTS.md", ".opencode/instructions/*.md"],

  "permission": {
    "edit": "allow",
    "bash": {
      "git *": "allow", "npm *": "allow", "npx *": "allow", "node *": "allow", "rtk *": "allow",
      "ls *": "allow", "cat *": "allow", "mkdir *": "allow", "cp *": "allow",
      "echo *": "allow", "export *": "allow", "ps *": "allow", "tail *": "allow",
      "head *": "allow", "find *": "allow", "grep *": "allow",
      "sudo gh *": "allow", "sudo /opt/*": "allow", "ssh-keyscan *": "allow",
      "nohup *": "allow", "wait *": "allow",
      "kill *": "ask", "curl *": "ask", "wget *": "ask",
      "rm *": "deny", "rm -rf *": "deny", "sudo rm *": "deny", "chmod 777 *": "deny",
      "*": "ask"
    },
    "external_directory": {
      "/home/eirene/**": "allow", "/home/projects/**": "allow",
      "/root/.config/opencode/**": "allow", "/tmp/opencode/**": "allow",
      "*": "ask"
    }
  },

  "plugin": ["opencode-synced", "./.opencode/plugins/graphify.js"],

  "skills": { "paths": [".opencode/skills"] },

  "experimental": { "primary_tools": ["edit"], "batch_tool": true },

  "compaction": { "auto": true, "tail_turns": 8 }
}
```

### systemd unit (referensi)

```
# /etc/systemd/system/opencode.service
[Unit]
Description=Opencode Web Server
After=network.target
[Service]
Type=simple
Environment=OPENCODE_SERVER_PASSWORD=REPLACE_ME
Environment=OPENCODE_YOLO=true
Environment=PATH=/usr/local/bin:/usr/bin:/bin:/root/.cargo/bin
ExecStart=/usr/local/bin/opencode web --hostname 0.0.0.0 --port 4097
WorkingDirectory=/home/projects
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target

# opencode2.service — sama, host 127.0.0.1 port 4098

# opencode-proxy.service
ExecStart=/usr/local/bin/node /opt/opencode-proxy/server.mjs
WorkingDirectory=/opt/opencode-proxy
Environment=NODE_ENV=production
```

### `AGENTS.md` — AI Agent Constitution Lite (`/home/projects/AGENTS.md`)

```markdown
# AI Agent Constitution (Lite)
# 0) DELEGATION GATE (MANDATORY) — sebelum kerja: klasifikasi simple vs complex;
#    complex → STOP & delegate task(): code-review→code-reviewer, bug→debugger,
#    architecture→architect, CI/CD/infra→devops, security→security-auditor,
#    tests→tester, docs→documenter, search→explore, IT planning→chloe-skills.
# 1) SELF-AWARENESS — verifikasi resource sebelum klaim limitasi.
#    Agents: orchestrator, code-reviewer, debugger, architect, explore, tester,
#    documenter, security-auditor, devops, chloe-skills
#    Skills: code-quality, scaffold, graphify, customize-opencode
#    MCP: filesystem, git, memory, sequential-thinking, browser, android, docker,
#    ssh(disabled), database, context7, deepwiki
# 2) No-apologies execution; 3) Verify before claiming; 4) Prefer MCP.
# (Salin konten penuh dari machine A /home/projects/AGENTS.md)
```
(Salin file penuh dari machine A — file ini 3.2 KB, berisi aturan lengkap.)

### `plugins/graphify.js` (global & project)

```js
import { existsSync } from "fs";
import { join } from "path";

export const GraphifyPlugin = async ({ directory }) => {
  let reminded = false;
  return {
    "tool.execute.before": async (input, output) => {
      if (reminded) return;
      if (!existsSync(join(directory, "graphify-out", "graph.json"))) return;
      if (input.tool === "bash") {
        output.args.command =
          'echo "[graphify] knowledge graph at graphify-out/. For focused questions, run graphify query with your question (scoped subgraph, usually much smaller than GRAPH_REPORT.md) instead of grepping raw files. Read GRAPH_REPORT.md only for broad architecture context." ; ' +
          output.args.command;
        reminded = true;
      }
    },
  };
};
```

### Skill kecil (referensi)
- `code-quality/SKILL.md` — linting, typecheck, formatting, dead code, complexity, docs, test coverage; perintah `npm run lint/typecheck/format`, `npm test`; metrik >80% coverage, SOLID.
- `scaffold/SKILL.md` — template project TS (src/tests/docs, eslint, vitest, husky), git init flow.
- `background-bash/SKILL.md` — pola `nohup <cmd> > /tmp/opencode-bg/<job>.log 2>&1 &`.
- `sandbox-rules/SKILL.md` — matriks izin direktori per agent (orchestrator, code-reviewer, debugger, architect, tester, devops, security-auditor), restricted paths (/root/.ssh/**, /root/.config/gh/**, /var/log/**).

---

## LAMPIRAN — Daftar File Yang Harus Disalin Dari Machine A (checklist)

```
~/.config/opencode/opencode.jsonc
~/.config/opencode/package.json + package-lock.json
~/.config/opencode/agent/orchestrator.md
~/.config/opencode/agent/{code-reviewer,debugger,architect,tester,documenter,devops,security-auditor,plan,chloe-skills}.md
~/.config/opencode/plugins/{graphify.js,opencode-plugin.js,rtk.ts}
~/.config/opencode/skills/graphify/  (seluruh folder + references/)
~/.config/opencode/tui.json
~/.config/opencode/opencode-synced.jsonc
~/.bashrc  (env + alias rtk/graphify/git)
/opt/opencode-proxy/{server.mjs,config.json,restart.sh,wrapper.html,manifest.json,sw.js,icons/*,package.json}
/etc/systemd/system/{opencode,opencode2,opencode-proxy,pixel-agents,ai-dashboard}.service
/home/projects/AGENTS.md
/home/projects/opencode.jsonc
/home/projects/.opencode/{opencode.json,plugins/graphify.js,skills/code-quality,skills/scaffold,instructions/project-structure.md}
/home/eirene/AGENTS.md
/home/eirene/opencode.jsonc
/home/eirene/.opencode/{agent/scrum-*.md, skills/background-bash, skills/sandbox-rules}
/home/projects/pixel-agents/  (repo — clone fresh + build)
~/.pixel-agents/{config.json, server.json, hooks/claude-hook.js}
```

> **KECUALI** (tidak disalin): `.jailbreak` (tidak termasuk), state DB sesi (opencode.db), auth.json token (dibuat ulang), server.json pixel-agents (auto-regenerate), .restart-lock/.continue (runtime state).

---

## Catatan Operasional (dari machine A)

- **Model agent yang terbukti jalan**: `openrouter/~deepseek/deepseek-v4-flash-latest` (paling stabil untuk multi-agent/sub-agent).
- **Blue-green restart**: `/opt/opencode-proxy/restart.sh` — memakai `rcurl`, bukan curl. Health check via 4096 (proxy) & Basic auth `opencode:__OPENCODE_PASSWORD__`.
- **Hati-hati**: jangan pernah pakai `curl`/`wget` standard — sudah di-rename ke rcurl/rwget; semua tool hook harus mengikuti hardening ini.
- **Pixel Agents**: restart service = token server.json berubah → state standalone ke-reset (agents[] kosong) → sesi baru akan diadopsi ulang.