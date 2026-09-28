---
name: sandbox-rules
description: "Use when defining or enforcing sandbox boundaries for agent execution. Controls file access, network restrictions, and tool permissions per agent or per task."
---

# Sandboxing Rules

Define and enforce execution boundaries for agents in the Eirene Master project.

## Directory Sandboxing

### Allowed Directories (by agent type)

| Agent | Allowed Paths | Description |
|-------|---------------|-------------|
| **orchestrator** | `/home/eirene/**`, `/root/.config/opencode/**` | Full project access |
| **code-reviewer** | `/home/eirene/eirene-master/**` | Read-only project access |
| **debugger** | `/home/eirene/eirene-master/**` | Full project access for debugging |
| **architect** | `/home/eirene/eirene-master/**`, `/home/eirene/eirene-master/docs/**` | Project + docs |
| **tester** | `/home/eirene/eirene-master/apps/**`, `/home/eirene/eirene-master/engine/**` | App + engine code |
| **devops** | `/home/eirene/eirene-master/iac/**`, `/home/eirene/eirene-master/.github/**` | Infrastructure only |
| **security-auditor** | `/home/eirene/eirene-master/**` | Full read access for audit |

### Restricted Paths (all agents)

```
# NEVER access these without explicit user approval
/root/.ssh/**
/root/.config/gh/**
/var/log/**
/etc/shadow
/etc/passwd
```

## Network Sandboxing

### Allowed Network Operations

| Operation | Allowed | Notes |
|-----------|---------|-------|
| `git clone/push/pull` | ✅ | GitHub only |
| `npm install` | ✅ | npm registry only |
| `docker pull/build` | ✅ | Docker Hub + Artifact Registry |
| `curl/wget` | ⚠️ | Ask first |
| `ssh` | ❌ | Never from agents |
| `scp/rsync` | ❌ | Never from agents |

### Blocked Outbound Connections

```
# Internal network only
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16

# Block metadata endpoints
169.254.169.254
```

## Tool Permission Matrix

| Tool | orchestrator | code-reviewer | debugger | tester | devops | security-auditor |
|------|-------------|---------------|----------|--------|--------|-----------------|
| read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| edit | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| bash | ✅ (restricted) | ❌ | ✅ (restricted) | ✅ (test runners only) | ✅ (infra only) | ✅ (audit tools only) |
| glob | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| grep | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| task | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| webfetch | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Bash Command Allowlists

### tester
```
allow: npm test*, npx jest*, npx vitest*, pytest*, go test*, make test*
deny: rm*, sudo*, chmod*, chown*, curl*, wget*
```

### devops
```
allow: docker*, kubectl*, terraform*, helm*, make deploy*, git*
deny: rm -rf*, sudo rm*, chmod 777*, curl | bash*
```

### security-auditor
```
allow: npm audit*, npx audit*, pip audit*, trivy*, gitleaks*, grep*, find*
deny: rm*, sudo*, chmod*, docker run*
```

## Enforcement

These rules are enforced via:
1. **opencode.jsonc** — `permission` section for tool-level controls
2. **Per-agent configs** — `permission` in agent frontmatter
3. **This skill** — documentation and reference for agents

When a rule is violated, the agent should:
1. Explain what was blocked and why
2. Suggest an alternative approach
3. Ask the user for explicit approval if the operation is needed
