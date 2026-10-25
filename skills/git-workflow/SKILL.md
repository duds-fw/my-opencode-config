---
name: git-workflow
description: "The git discipline for the two duDdev repositories: commit before a task closes, carry the commit SHA in the deliverable, never push without the owner's go-ahead, and never commit state/."
---

# Git Workflow

## The two repositories

| Repository | Remote | Branch |
|---|---|---|
| Virtual Office | `https://github.com/duds-fw/virtual-office.git` | `main` |
| OpenCode config | `https://github.com/duds-fw/my-opencode-config.git` | `main` |

Both are **local-only by default**. A local commit is not a push.

## The standing rules

1. **Commit every code change locally before the task leaves
   `in_progress`.** Committing is inside your authority — do it without
   asking. A task whose deliverable is code but which has no commit is not
   finished.
2. **A deliverable of kind `code` must carry the commit SHA in
   `deliverable.ref`.** The office refuses to close such a task without it.
3. **Never push, open a pull request, tag a release, or write to a remote**
   without the owner's explicit go-ahead. Those are client-visible actions
   and they belong to the owner.
4. **Never commit `state/`.** The office's `.gitignore` already excludes
   `state/` and `state/client.json`; the server owns that directory and
   rewrites it in memory on every tick. `state/client.json` holds the owner
   bot token — if it ever appears in a commit, it is in the history
   permanently.
5. **If you find yourself editing a file that is not under version control,
   that is the more urgent problem.** Fix the version control first, then do
   the feature work. Recoverability outranks features.

## Commit hygiene

- **Focused and atomic.** One logical change per commit. A commit that fixes
  a bug and reformats three files is unreviewable and, when it breaks, it is
  unbisectable.
- **Conventional-commit style** where it fits:
  `fix(server): refuse caller-supplied acceptance state`.
- **No secrets, keys or credentials** — not in the diff, not in a log line,
  not in a commit message.
- **Check `git status` before a large change** so you know what was already
  modified and do not accidentally sweep someone else's work into your
  commit.

## The commit SHA is evidence

A SHA in `deliverable.ref` is a *reference to something that exists*. That
means the format must be checked, not just that the field is non-empty:

- a full 40-character hex SHA is a commit;
- a short SHA that `git cat-file -e` resolves is acceptable;
- `'x'`, `'HEAD'`, a branch name, or an empty string is **not** a SHA.

Verify before you write it:

```bash
git cat-file -e <sha>^{commit} && echo "sha resolves"
```

A bogus SHA passed certification once. Treat an unresolvable SHA as a
failed check, not as a formality.

## Reviewing your own diff

Keep the diff small enough that it can actually be reviewed — by you and by
the next reviewer:

```bash
git status          # what changed
git diff            # the unstaged change
git diff --cached   # what is staged for commit
rtk diff            # summarised form, lower token cost
```

Before committing, look for: unrelated changes, debug leftovers
(`console.log`, commented-out code, a stray `.only`), a file that changed
but was never mentioned in the report, and a guard that compares a field
that does not exist.

## Outputs

Report the repository, the branch, the commit SHA you created, the files in
the commit, whether you pushed (and that you did not, without the owner's
go-ahead), and anything you deliberately left uncommitted.

## Common mistakes

- Committing `state/` because `git add -A` picked it up.
- Writing a `deliverable.ref` that is not a resolvable SHA.
- Pushing because the change "looks finished" — a push is the owner's call.
- One commit for a whole task, so a reviewer cannot find the defect.
- Leaving a change uncommitted so the task could be "closed" with a clean
  working tree, hiding work that is not recoverable.
