---
name: dependency-audit
description: "Audit dependencies, secrets and configuration across the duDdev repositories: the zero-dependency office, bootstrap-pkg tooling, secret scanning, and the git history of both repos."
---

# Audit dependencies, secrets and configuration

Produces the dependency, secret and configuration picture of the duDdev
repositories. Use on a schedule, before a release, or when asked "what are we
running and what is exposed".

## The ground truth: the office has no dependencies

`/home/opencode/virtual-office` has no `package.json`, no `package-lock.json`
and no `node_modules`. Node runs the files directly.

Check the office's own imports:

```
grep -rho "require('[^']*')" /home/opencode/virtual-office/*.js \
  /home/opencode/virtual-office/tools/*.js | sort -u
```

Every entry must be a Node built-in (`fs`, `path`, `http`, `crypto`, `os`,
`child_process`, `assert`, `node:sqlite`) or a relative `./` path. A bare
package name is a finding: a dependency has crept in.

`node:sqlite` (token-savings.js:76) is a built-in, not a package — and the box
runs Node v20, where it throws and the code falls back to the sqlite CLI.

## Where a dependency does exist

`bootstrap-pkg/infra/package.json` declares one: `http-proxy ^1.18.1`, used by
`bootstrap-pkg/infra/server.mjs`. That is the only `node_modules`-referencing
tree in the organisation.

There is no lock file and no `node_modules/` on the box, so `npm audit` cannot
produce a real advisory report here — it needs a lock file to resolve a
dependency tree. Report that as a limitation, not as a clean result.

## Check the tooling before you instruct anyone to run it

```
command -v npm pip pip-audit trivy gitleaks trufflehog semgrep osv-scanner
```

On this box only `npm` and `pip` are installed; `pip-audit`, `trivy`,
`gitleaks`, `trufflehog`, `semgrep` and `osv-scanner` are absent. Do not
instruct a team to run a scanner that is not there, and do not report "no
vulnerabilities" when no scanner ran. If a scanner is wanted, its absence is
the finding to escalate.

## Secret scanning without gitleaks

What a credential looks like here: a Telegram bot token
(`^\d+:[A-Za-z0-9_-]{20,}$` — the shape client.js:68 validates),
`ghp_`/`github_pat_`, `sk-`, `AKIA`, `-----BEGIN ... PRIVATE KEY-----`, and
`TELEGRAM_BOT_TOKEN=`.

Where to look, and how:

- `state/client.json` — mode 0600 (client.js:53), holds the owner bot token.
  Confirm the mode with `ls -l state/client.json`.
- The office's tracked files:
  `git -C /home/opencode/virtual-office grep -nIE "[0-9]{6,}:[A-Za-z0-9_-]{30,}" -- .`
  → expect no hits. Repeat for `/home/opencode/.config/opencode`.
- Both repos' history: `git -C <repo> log --all -p -- 'state/'` → expect empty.
  A secret in history is compromised: rotate first, then rewrite history.

Do not filter candidates by file name alone — `token-compliance.js`,
`token-savings.js` and `tools/token_report.py` match the word "token" and hold
no secret.

## The two repositories and the git rules

- `duds-fw/virtual-office` — the office. `state/` is gitignored
  (`.gitignore:3`): `git -C /home/opencode/virtual-office check-ignore -v
  state/client.json` → `.gitignore:3:state/ state/client.json`. Never commit
  `state/`; never push without the owner.
- `duds-fw/my-opencode-config` — the agent configuration and skills. Its
  `state/` is **not** gitignored and `state/model.json` is tracked. It holds no
  credential today; if one ever lands there it is committed by default. That
  asymmetry is worth a finding.
- Report a secret by location, mode and rotation advice — never by value.

## Configuration surface

`server.js` reads `PORT` (default 9012), `HOST` (default `0.0.0.0`,
server.js:8) and `OPENCODE_BIN` (default `/root/.opencode/bin/opencode`,
server.js:10) from the environment. The service is the systemd unit
`virtual-office.service`; its environment is the configuration surface. A
finding: the API bound to `0.0.0.0`, or a binary path taken from an env var
that a non-root user can set.

## Third-party skills are supply chain

Two installed skills are third-party: `skills/frontend-design` and
`skills/webapp-testing`, both Apache-2.0 from `anthropics/skills`, each keeping
its `LICENSE.txt`. Verify with
`head -5 skills/frontend-design/LICENSE.txt` — it shows the Apache License 2.0
text.

Before any third-party skill is installed: read every file it ships, read its
`SKILL.md` for instructions that run commands or read credentials, confirm the
license file is retained, and record the source repo and version in the report.
The remaining skills under `skills/` are first-party.

## Outputs

- The dependency picture: office, `bootstrap-pkg`, and anything new.
- The secret picture: locations, modes, rotation advice, no values.
- The tools that ran, and the ones that are absent and were therefore skipped.
- The findings that need an owner decision.

## Common mistakes

- Running `npm audit` on a repo with no lock file and calling it clean.
- Telling a team to install gitleaks or trivy as if they were already there.
- Pasting a token prefix "just so it can be found".
- Assuming the config repo ignores `state/` because the office repo does.
- Treating an absent scanner as a pass.
