# Exploration tooling reference

Verified flags for `rtk` (as installed at `/usr/local/bin/rtk`). Run
`rtk <command> --help` to re-check before relying on a flag.

## Reading

| Command | Effect |
|---|---|
| `rtk read -n FILE` | line numbers |
| `rtk read --head-lines N FILE` | first N lines, byte-exact at `--level none` |
| `rtk read --tail-lines N FILE` | last N lines |
| `rtk read -m N FILE` | **structural** preview capped at N lines — signatures and imports, not the top of the file |
| `rtk read --level minimal FILE` | minimal filtering |
| `rtk read --level aggressive FILE` | aggressive filtering |
| `rtk read FILE1 FILE2` | multiple files in one call |
| `rtk wc -l FILE` | line count (also `-w`, `-c`) |
| `rtk ls [dir]` | compact listing; accepts native `ls` flags |
| `rtk tree -L N [dir]` | depth-limited tree |
| `rtk find . -name '*.md' -type f` | compact find; accepts native find flags |

## Searching

| Command | Effect |
|---|---|
| `rtk grep PATTERN [PATH] [flags]` | compact grep; accepts `-i`, `-A 3`, `--glob`, `-v` |
| `rtk grep --max 30 PATTERN PATH` | cap the number of results |
| `rtk grep --max-len 120 PATTERN PATH` | truncate long lines (default 80) |
| `rtk grep --context-only PATTERN PATH` | match context only, not the full line |
| `rtk rg PATTERN [PATH] [flags]` | ripgrep native; `-t js`, `--glob '*.md'`, `-w`, `-v` |
| `rtk ast-grep PATTERN` | structural matches, grouped by file |
| `grep -n PATTERN FILE` | exact line numbers — the cheapest way to feed a range read |

## Diff and version control

| Command | Effect |
|---|---|
| `rtk git status` | compact status |
| `rtk git diff` | condensed diff of the working tree |
| `rtk git log` | one-line history |
| `rtk git show` | compact show (summary + stat + compacted diff) |
| `rtk diff FILE1 FILE2` | ultra-condensed diff of **two** files; a single operand is a usage error — use `rtk git diff` for the working tree |

## Structured output

| Command | Effect |
|---|---|
| `rtk json FILE` | compact JSON values |
| `rtk json --keys-only FILE` | structure without values |
| `rtk json -d 3 FILE` | cap nesting depth (default 5) |
| `jq 'FILTER' FILE` | field-level extraction — always prefer to reading the file |
| `python3 -c "..."` | one-off JSON work; print only what is needed |

## Bulky payloads

The caveman MCP tools compress what the wrappers cannot: `caveman_compress` for
text and tool output, `caveman_toon_encode` for tabular JSON (arrays of
same-shaped objects). Both are reversible — recover with `caveman_retrieve` using
the returned handle. Use them when a single JSON document would otherwise land
in context whole.

## The office's own exploration targets

| Question | File | Size |
|---|---|---|
| Stage machine, P1–P9 | `virtual-office/project-pipeline.js` | 435 lines |
| Lifecycle, criteria, tasks | `virtual-office/agency.js` | 1676 lines |
| Routes, autonomy tick | `virtual-office/server.js` | 1996 lines |
| Pipeline design and API contract | `virtual-office/docs/design-project-pipeline.md` | §2 RACI, §4 invariants, §5 API |
| Architecture graph | `virtual-office/graphify-out/` | `graph.json`, `GRAPH_REPORT.md` |
