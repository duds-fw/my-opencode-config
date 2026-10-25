---
name: codebase-exploration
description: "Find the right code in an unfamiliar repo without flooding context: rtk wrappers, targeted greps, line ranges, JSON filtering, and graphify for architecture."
---

# Explore a codebase without drowning in it

Locate the few lines that decide the question, and read nothing else. The office
is billed per token, so a full-file read that answered nothing is a real cost.

## 1. Classify the question before searching

| Question | Move |
|---|---|
| "Which function does X?" | targeted grep for the symbol, then read its range |
| "Does this repo already do Y?" | grep for the *behaviour* word, not the concept |
| "How do these files relate?" | `graphify` skill — architecture and relationships |
| "What does this file do?" | `rtk read -m` structural preview, then one range |

## 2. Orient before you read

```bash
rtk ls docs/            # compact listing
rtk tree -L 2           # two levels, no noise
rtk find . -name '*.md' -type f
rtk wc -l agency.js     # size first, always
```

`rtk wc` before any read: a 1996-line file read whole costs ~2000 lines of context.

## 3. Search with the smallest tool that works

| Tool | Beats raw `grep` when |
|---|---|
| `rtk grep <pat> <path>` | you want compact, grouped, truncated output; `--max 30`, `--max-len 120`, `--context-only` |
| `rtk rg <pat> <path>` | you need native ripgrep flags: `-t js`, `--glob '*.md'`, `-v`, `-w` |
| `grep -n <pat> file` | you need exact line numbers to feed a range read — it is the cheapest search there is |
| `rtk ast-grep <pat>` | you want the *structure* of a call site, not every text match |

Use `grep -n` when the next step is `read <file> --offset N --limit M`: line
numbers are the contract between the two.

## 4. Read only the range you need

```bash
rtk read -n --head-lines 60 agency.js       # first 60 lines, byte-exact
rtk read --tail-lines 40 server.js          # last 40 lines
rtk read -m 40 project-pipeline.js          # 40-line structural preview
```

`rtk read -m` is a **structural** preview (signatures and imports), not the first
N lines — use `--head-lines` when you want the top of the file.

Then read precise ranges with the read tool (`offset`/`limit`), never the whole
file. `project-pipeline.js` is 435 lines and `agency.js` is 1676: read the
pipeline in one go when the question is about the rules, read `agency.js` in
30-line slices when it is about one function.

## 5. Filter structured output at the source

Never download a document to read one field.

```bash
jq '.projects[] | {id, name, status}' state/projects.json
jq 'keys' state/tasks.json
python3 -c "import json;d=json.load(open('state/tasks.json'));print(len(d.get('tasks',[])))"
rtk json --keys-only state/sprints.json
```

Do not read `state/client.json` — it holds the owner bot token. Do not read
`state/*.json` at all while the server is running: it owns that state in memory
and will overwrite your edit. The API is the source of truth.

## 6. Use `graphify` for architecture questions

`virtual-office/graphify-out/` holds `graph.json`, `GRAPH_REPORT.md` and
`manifest.json`. When the question is "what depends on what", "which module owns
this", or "what breaks if I change X", load the **graphify** skill and query the
graph — do not hand-grep for relationships across 15 files.

Do not use graphify for "where is this function defined". It is for structure.

## 7. When reading a whole file is justified

Read it whole only when all three hold:

1. It is under ~500 lines (`rtk wc -l`), **and**
2. you need most of it — not one function — **and**
3. you are about to edit it, or it is the single authority for the answer
   (`project-pipeline.js` is the authority on P1–P9; `docs/design-project-pipeline.md`
   is the authority on the pipeline design).

Everything else is a range read.

## 8. Bound every delegation

A delegation without boundaries multiplies context across every session it
touches. Name three things:

- the exact files to read (paths, not "the codebase")
- the one question to answer
- the expected output size ("≤ 20 lines", "one table row per match")

Report outcomes — status, counts, paths, verdicts — never file contents.

## Outputs

- The exact file path and line range that answers the question
- The function names and field names actually found (quoted from source)
- What could not be located, and what was searched instead

## Common mistakes

- Reading `agency.js` whole to answer a question about one function
- Trusting a remembered field name — the office's own defect was a guard that
  compared `project.projectId` when the record carries `id`. Read the field.
- Grepping for a concept ("acceptance") when the code says `acceptanceCriteria`
- Delegating "explore the repo" without naming files and a question
