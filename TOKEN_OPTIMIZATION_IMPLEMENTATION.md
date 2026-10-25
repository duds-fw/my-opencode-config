# Token Optimization Implementation

## Changes Implemented

### 1. Configuration Changes

#### opencode.jsonc
- `default_agent`: orchestrator (primary lead agent)
- `compaction.keep.tokens`: 30000 → 8000 (experiment)
- `compaction.buffer`: 20000 (unchanged)
- `compaction.auto`: true, `compaction.prune`: true
- `small_model`: removed (deprecated in v2.1.3)
- `model`: minimax-coding-plan/MiniMax-M3.1-Flash (primary)
- `provider`: {} (removed caveman proxy base URLs for portability)
- `plugins`: caveman-native.js, caveman-blocks.js, rtk.ts
- `mcp.servers`: 12 servers configured
- `skills`: ["./skills"]
- `instructions`: ["AGENTS.md", "README.md"]

#### AGENTS.md
- Added Token Economy section with rtk/caveman usage rules
- Preserved existing rules (general, git, safety)

#### cli.json
- Theme: tokyonight (system mode)
- Keybinds: input_submit=ctrl+return, input_newline=return,shift+return,alt+return,ctrl+j
- Session: sidebar auto, thinking hidden, TPS on, markdown rendered

### 2. Installed Tools

| Tool | Version | Location | Purpose |
|---|---|---|---|
| RTK | 1.0.1 | /usr/local/bin/rtk | Token-saving CLI wrapper |
| Graphify | 0.9.94 | /usr/local/bin/graphify | Knowledge graph builder |
| Caveman | 4.0.1 | /usr/local/bin/caveman | Token compression + MCP |
| UV | 0.13.5 | /root/.local/bin/uv | Python package manager |
| Pip | 26.2.2 | /usr/local/lib/python3.12 | Python package installer |
| Node.js | 20.18.0 | /usr/local/bin/node | MCP server runtime |

### 3. MCP Servers Configured

| Server | Type | Command/URL | Status |
|---|---|---|---|
| context7 | remote | https://mcp.context7.com/mcp | connected |
| deepwiki | remote | https://mcp.deepwiki.com/mcp | connected |
| caveman | local | /root/.caveman/bin/caveman-mcp | pending |
| playwright | local | npx -y @playwright/mcp | pending |
| sequential-thinking | local | npx -y @modelcontextprotocol/server-sequential-thinking | pending |
| memory | local | npx -y @modelcontextprotocol/server-memory | pending |
| filesystem | local | npx -y @modelcontextprotocol/server-filesystem /home/opencode | pending |
| docker | local | npx -y mcp-docker-server | pending |
| database | local | npx -y @cocaxcode/database-mcp | pending |
| git | local | npx -y @modelcontextprotocol/server-git | pending |
| ssh | local | npx -y ssh-mcp --host=127.0.0.1 --user=root --disableSudo | pending |
| android | local | npx -y android-mcp-server | pending |

### 4. Rollback Instructions

```bash
# Revert opencode.jsonc
cd /home/opencode/.config/opencode
git checkout HEAD~1 -- opencode.jsonc

# Remove caveman
caveman uninstall 2>/dev/null
rm -f plugins/caveman-native.js plugins/caveman-blocks.js

# Remove rtk
rm -f /usr/local/bin/rtk

# Remove graphify
pip uninstall -y graphifyy 2>/dev/null
```
