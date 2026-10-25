# Token Spike Incident Report

## Observed Symptoms

- MiniMax Token Plan shows ~125M tokens consumed in a 5-hour window (user reported)
- MiniMax quota error 2056: "Token Plan usage limit reached" appearing in logs
- OpenRouter error: "You requested up to 128000 tokens, but can only afford 9547"
- Multiple sessions failing simultaneously with quota exceeded errors
- 5 active sessions, 33 subagents, 236 prompts, 2.2k steps, 373.2M total tokens

## Confirmed Facts

### Environment
- OpenCode v2.1.3 (standalone binary at /root/.opencode/bin/opencode)
- RTK v1.0.1 installed and functional (11 commands, 36.7% savings)
- RTK plugin (rtk.ts) is loaded and intercepts bash/shell commands
- Caveman v4.0.1 installed with proxy on :8787
- 12 MCP servers configured (context7✓, deepwiki✓, 10 pending)
- 3 plugins active: caveman-native.js, caveman-blocks.js, rtk.ts

### Model Configuration
- Primary model: minimax-coding-plan/MiniMax-M3.1-Flash
- small_model: opencode-go/glm-5.3-flash (set but shows as None in debug)
- Compaction: auto=true, prune=true, keep=8000 tokens, buffer=20000

### MiniMax Quota Status
- Weekly: 79% remaining (21% used)
- Interval: 0% remaining (exhausted)
- Model: "general" (only model shown in quota response)
- Error 2056: Token Plan usage limit reached

### Session Data
- 5 active sessions:
  1. setup-opencode (current, 10/25 8:52 AM)
  2. Office offer pitch (10/25 8:46 AM)
  3. Virtual office for product operations (10/25 7:18 AM)
  4. probe123 (10/24 1:57 AM)
  5. office_probe (10/24 1:56 AM)
- 78 sessions total, 33 subagents, 236 prompts, 2.2k steps
- 373.2M total tokens (all time)

### RTK Integration Status
- RTK binary: /usr/local/bin/rtk v1.0.1 (working)
- RTK plugin: rtk.ts loaded, intercepts bash/shell commands
- RTK gain: 11 commands, 36.7% savings (520→329 tokens)
- **LIMITATION**: RTK only rewrites bash/shell commands. It does NOT optimize:
  - MCP tool calls (filesystem, database, etc.)
  - read/glob/grep tool calls
  - Agent-to-agent context handoffs
  - System prompt loading
  - Skill instruction loading

### Compaction Settings
- Current: auto=true, prune=true, keep=8000 tokens, buffer=20000
- Old (v1): auto=true, tail_turns=8
- The old config used tail_turns (number of turns) vs new uses token-based keep

### Previous vs Current Differences

| Aspect | Previous (v1.18.18) | Current (v2.1.3) | Impact |
|---|---|---|---|
| Config format | V1 (agent, command, plugin, permission, mcp flat) | V2 (agents, commands, plugins, permissions, mcp.servers) | Different loading behavior |
| Model | Not set in config (default) | minimax-coding-plan/MiniMax-M3.1-Flash | Explicit model may increase usage |
| Compaction | tail_turns: 8 | keep: 8000 tokens | Different retention |
| MCP servers | 11 (flat keys) | 12 (nested under servers) | More servers loaded |
| Plugins | opencode-synced, graphify.js | caveman-native.js, caveman-blocks.js, rtk.ts | More plugin overhead |
| Skills | graphify (0.9.26) | graphify (0.9.94), chloe-skills | More skill instructions |
| Agent definitions | 10 agents in agent/ dir | 11 agents in agents/ dir | More agent prompts |
| Subagent depth | Not configured | 2 (experimental) | Deeper nesting possible |

### Root Causes (Ranked by Evidence)

1. **HIGHEST: Multiple concurrent sessions draining simultaneously**
   - Evidence: 5 active sessions, all showing "Failed to drain Session" with quota exceeded
   - The "Virtual office for product operations" and "Office offer pitch" sessions suggest autonomous office work
   - Each session independently loads full context and makes model calls
   - Impact: 5x context loading, 5x model requests

2. **HIGH: RTK only optimizes bash/shell commands**
   - Evidence: RTK gain shows only 11 commands, 36.7% savings (520→329 tokens)
   - RTK does NOT optimize: MCP tool calls, read/glob/grep, agent handoffs, system prompts, skill loading
   - The vast majority of token consumption comes from non-bash operations
   - Impact: RTK provides minimal overall savings

3. **HIGH: MCP server schemas loaded into context**
   - Evidence: 12 MCP servers configured, including database (34 tools), docker (10), playwright (25)
   - All MCP tool definitions are loaded into the model context regardless of usage
   - Even unused servers contribute schema overhead
   - Impact: Large, constant context overhead per request

4. **MEDIUM: Long-running sessions with compaction**
   - Evidence: "Virtual office for product operations" session running since 7:18 AM
   - Compaction keep=8000 tokens but buffer=20000
   - Long sessions accumulate context even with compaction
   - Impact: Growing context per request in long sessions

5. **MEDIUM: Subagent depth = 2**
   - Evidence: experimental.subagent_depth=2 configured
   - Subagents can spawn their own subagents, multiplying context
   - Each subagent gets its own context window
   - Impact: Deeper nesting = more context loading

6. **LOW: Caveman proxy base URLs removed**
   - Evidence: Provider base URLs were pointing to caveman proxy (127.0.0.1:8787)
   - These were removed for portability
   - Impact: Caveman compression may not be active for all requests

### Token Consumption Breakdown (Estimated)

Based on available data:
- 78 sessions, 33 subagents, 236 prompts, 2.2k steps
- 373.2M total tokens (all time)
- ~125M in 5 hours = ~25M/hour

Likely distribution:
- System prompts + agent instructions: ~5-10K tokens per request
- MCP tool schemas: ~10-20K tokens per request (12 servers)
- Skill instructions: ~5-10K tokens (graphify SKILL.md is 39KB)
- Conversation history: grows per session (compaction at 8000 keep)
- Tool outputs: variable, potentially large
- Subagent context: each subagent gets full context

### Most Likely Root Cause

The primary driver of the 125M token spike is **multiple concurrent long-running sessions** (especially autonomous office sessions) each independently loading full context and making model calls. The RTK plugin only optimizes bash commands (minimal savings), while the bulk of token consumption comes from:
1. MCP tool schema overhead (12 servers, 100+ tools)
2. Agent instruction loading
3. Skill instruction loading (graphify SKILL.md is 39KB)
4. Conversation history accumulation
5. Subagent context multiplication

### Minimal Corrective Action Plan

1. **Immediate**: Reduce concurrent sessions - consolidate autonomous office work into fewer sessions
2. **Immediate**: Disable unused MCP servers per-project (keep only context7, deepwiki, caveman core)
3. **Short-term**: Remove or condense large skill files (graphify SKILL.md at 39KB)
4. **Short-term**: Set compaction keep to 4000 tokens (more aggressive)
5. **Short-term**: Remove subagent_depth experimental (default to 1)
6. **Medium-term**: Implement task-specific MCP enablement
7. **Medium-term**: Benchmark free models for lightweight tasks

### Controlled Validation Procedure

1. Create a fresh session with minimal context
2. Run a simple task (e.g., "list files in current directory")
3. Record token usage from MiniMax quota before/after
4. Run a representative autonomous task
5. Compare against baseline

### Limitations

- No previous machine configuration available for direct comparison (only bootstrap-pkg from git history)
- MiniMax quota API only shows "general" model, not per-model breakdown
- OpenCode does not expose per-request token counts via CLI
- RTK gain only tracks bash commands, not MCP/agent context
- 125M figure is user-reported, not independently verified from telemetry
