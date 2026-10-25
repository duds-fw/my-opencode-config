# Token Optimization Audit

## Environment

- OpenCode v2.1.3 (standalone binary at /root/.opencode/bin/opencode)
- OS: Ubuntu 24.04.5 LTS (x86_64)
- Node.js v20.18.0, Python 3.12.3, UV 0.13.5
- Config location: /root/.config/opencode → /home/opencode/.config/opencode (symlink)
- GitHub repo: https://github.com/duds-fw/my-opencode-config

## Architecture

- Primary agent: orchestrator (mode: primary, steps: 100)
- Subagents: chloe-skills, devops, documenter, security-auditor, tester, plan, build, general, explore
- MCP servers: 12 (context7✓, deepwiki✓, caveman, playwright, sequential-thinking, memory, filesystem, docker, database, git, ssh, android)
- Plugins: caveman-native.js, caveman-blocks.js, rtk.ts
- Skills: graphify (0.9.94), chloe-skills (15 IT roles)
- Commands: review, explain, test
- RTK: v1.0.1 (Rust Token Killer)
- Graphify: v0.9.94 (knowledge graph)
- Caveman: v4.0.1 (token compression)

## Model Configuration

- Primary model: minimax-coding-plan/MiniMax-M3.1-Flash
- Small model: (not supported in this version - deprecated field)
- Free models available: opencode-go/beam-free, deepseek-v4.1-flash, glm-5.3-flash, mimo-v2.6-flash, qwen3.8-flash, iceman-contributor-free, minimax-m3.1-flash
- MiniMax quota: weekly 79% remaining, interval 0% (exhausted this interval)

## Baseline Findings

### Token Waste Sources Identified
1. **AGENTS.md** - Contains full orchestrator instructions duplicated across global config
2. **MCP servers** - 12 configured, many with large schemas (database: 34 tools, docker: 10, playwright: 25)
3. **Compaction** - keep: 8000 tokens (optimized from 30000), buffer: 20000, auto: true, prune: true
4. **Provider base URLs** - Were pointing to caveman proxy (portability issue, fixed)
5. **Duplicate caveman key** in mcp config (fixed)

### Optimizations Applied
1. Compaction keep tokens reduced from 30000 to 8000
2. Provider base URL overrides removed (portability)
3. Duplicate caveman MCP key removed
4. Caveman MCP plugin registered (caveman-native.js, caveman-blocks.js)
5. RTK plugin registered for token savings
6. AGENTS.md updated with token economy rules

### MCP Analysis
- Core: context7 (connected), deepwiki (connected), caveman (pending)
- Task-specific: playwright, sequential-thinking, memory, filesystem, docker, database, git, ssh, android
- All configured with portable npx commands

### Candidate Repositories (7)
Evaluated conceptually; detailed inspection deferred due to token budget. Key findings:
- Taste Skill + Impeccable: frontend workflow candidates
- Humanizer + Stop-Slop + No-AI-Slop + Avoid-AI-Writing: writing workflow candidates
- Anti-Slop: code cleanup candidate

### Unverified Assumptions
- MiniMax subscription tier not confirmed (quota shows "general" model only)
- Small model field not supported in v2.1.3 (deprecated)
- MCP server response sizes not measured
- No telemetry data available for token consumption
- Free model quality not benchmarked
