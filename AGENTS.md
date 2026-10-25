# Global Instructions

## General
- Be concise and practical. Ask for clarification when requirements are ambiguous.
- Prefer editing existing files over creating new ones.
- Follow existing code style and conventions in the project.
- Don't commit secrets, keys, or credentials.

## Token Economy
Context is the scarcest resource in this system. Treat every token as a cost
the office is charged for, and keep the working set small.

- **Never pour a large payload into context.** Before reading a file or API
  response, check its size. Filter at the source instead of reading then
  discarding.
- **Use the `rtk` command wrappers** for common output: `rtk ls`, `rtk read`,
  `rtk grep`, `rtk rg`, `rtk find`, `rtk git`, `rtk diff`, `rtk json`,
  `rtk tree`, `rtk wc`. They strip columns, drop noise, and summarize.
- **Filter structured output at the source** — `jq` / `python3 -c` for JSON,
  `grep -m` / `head` for text, `--keys-only` for large objects. Do not fetch
  a whole document to read one field.
- **Use the caveman MCP tools** for anything bulky: `caveman_compress` for
  text/tool output, `caveman_toon_encode` for tabular JSON. Both are
  reversible — recover with `caveman_retrieve` using the returned handle.
- **Scope every subagent delegation.** State the files to read, the question
  to answer, and the expected output size. A delegation without boundaries
  multiplies context cost across every session it touches.
- **Report outcomes, not payloads.** A checkpoint is status, counts, paths,
  and decisions — never a paste of file contents.
- **Prefer the summary of a command over its raw output** when both exist.
- **Do not re-read what you already read.** Cache the conclusion; re-reading
  to re-confirm costs a full context load for no new information.

## Knowledge Recall
- **Query the graph before you read.** When a project has `graphify-out/graph.json`,
  treat every question about that codebase, its history or its structure as a
  `graphify query` first. Read files only for what the query did not answer.
- **A session-history scan is a last resort.** Searching raw transcripts to
  recover a fact the project already knows is the most expensive way to ask.
  Query the graph, then the files, then — only if both fail — the history.
- **Keep the graph current.** If the graph is missing or older than a day,
  refresh it incrementally (`graphify . --update`) before relying on it.

## Git
- Use conventional commits where reasonable.
- Keep commits focused and atomic.

## Safety
- Don't run destructive commands (rm -rf, format) without confirmation.
- Check git status before making large changes.
