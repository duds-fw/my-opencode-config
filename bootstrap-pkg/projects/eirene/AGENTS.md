# Eirene Project — Agent Instructions

This file is the **root project instruction surface** for AI agents working across all Eirene repositories.

## Project Overview

Eirene is an AI-assisted incident restoration platform.

## Repository Layout

```
/home/eirene/
├── AGENTS.md                    # This file (root instructions)
├── opencode.jsonc               # Root opencode config
├── .opencode/skills/            # Shared skills (background-bash, sandbox-rules)
├── eirene-master/               # Frontend apps ONLY (Next.js)
│   ├── apps/landing/
│   ├── apps/admin/
│   ├── apps/console/
│   └── apps/sandbox/
│
/home/projects/
├── eirene-backend/              # Backend services (Go) — PRIMARY backends
│   ├── platform-gateway/        # Client onboarding, agent mgmt, bearer tokens (REST /api/v1/*)
│   ├── client-runtime-agent/    # VM/pod runtime agent, log collection, packaging
│   ├── log-collector/           # Stateless HTTP ingest → Kafka
│   └── Orchestrix-Continuum/    # Core AI analysis / incident remediation engine
```

> **Repo boundary**: `eirene-master` is frontend-only. All Go backend services live in `/home/projects/eirene-backend/*`. One shared knowledge ecosystem (memory graph + docs + backlog) covers all repos.

## Global Conventions

- **Git**: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Secrets**: never commit — use environment variables and Kubernetes secrets
- **Docker**: test with `docker build` before commit
- **Kubernetes**: validate manifests against the cluster
- **Terraform**: validate with `terraform validate` and `terraform plan`

## Local Dev Machine Policy

> **User directive (2026-08-16):** this machine (`/home/eirene`) is for **develop + push only** — no persistent services, no leftover test infra.

- Any container / DB / service / image started **only for testing** must be **deleted when the task is done** (container, volume, and data). Never leave test infra running "just in case" — tests must be skip-safe or reproducible on demand instead.
- Never publish test containers to `0.0.0.0` and never use default credentials (e.g., `postgres:postgres`). Bind to `127.0.0.1` and use strong generated passwords — even for throwaway test instances (real-world precedent: exposed `eirene-test-pg` with default creds was mined in < 5 days).
- `brave_benz` (Orchestrix engine test container) is the sole long-running test container; it is actively used. All future test containers follow the delete-when-done rule.
- Example of the correct pattern: US-49's `api/internal/db/db_test.go` — skip-safe via `TEST_DATABASE_URL`, so `go test ./...` stays green without a live DB.

## Per-Repo Instructions

Each repo has its own `AGENTS.md` with repo-specific rules. Always check the repo-level AGENTS.md before modifying code.

### eirene-master (Frontend)
- Next.js 16 App Router — read `node_modules/next/dist/docs/` before writing code
- TypeScript strict mode — no `any` types unless justified
- Tailwind CSS 4 — CSS-first config
- Per-app AGENTS.md in `apps/*/`

### eirene-backend (Go services in `/home/projects/eirene-backend/*`)
- Engine services are Go — use `make build test` for validation
- Check each repo's README/docs before modifying (client-runtime-agent docs live in its local `docs/` pack — see `docs/DOCUMENTATION_INDEX.md`; the legacy `ai-platform` repo reference no longer exists)
- `platform-gateway` REST API is `/api/v1/*` (client/agent/token mgmt) — distinct from BFF `/v1/auth/*`
- Kafka topics and SCRAM auth are configured via env (see `.env.example` per repo)

## Deployment

- **CI/CD**: GitHub Actions with Workload Identity Federation
- **Registry**: Google Artifact Registry (Docker images)
- **Cluster**: GKE regional, asia-southeast2
- **Domain**: eirene.donquixote.cloud
- **Environments**: dev (active), staging, prod

## Security

- TLS/SSL via Let's Encrypt + cert-manager
- Service-to-service auth (SCRAM-SHA-512 for Kafka)
- PostgreSQL password-protected
- RBAC configured for Kubernetes
- Review: ingress access control, secret management

## Agent Rules

1. **Check per-repo AGENTS.md** before modifying code
2. **Never commit secrets** — use environment variables and Kubernetes secrets
3. **Terraform changes** must be validated before apply
4. **Docker changes** must be tested before commit
5. **Engine services** are Go — use `make build test` for validation
6. **Capture knowledge** — update memory graph with new learnings
7. **Scrum-artifact discipline (all agents/subagents)**: any user request with development effort (code, config, infra, tests — anything beyond answering a question) MUST first become a task in a Scrum artifact — a user story in `eirene-master/docs/05-execution/agile/01_PRODUCT_BACKLOG.md`, a Sprint Backlog item in the active Sprint Plan, or a backlog task with a story ID. Never implement development work directly; route it through the Scrum flow (PO refines story → SM schedules → Dev implements → QA verifies → Reviewer gates). Exceptions: pure Q&A, file reads, one-off git ops, process/notes updates.
8. **Infra separation**: Kafka, MongoDB, PostgreSQL are external infrastructure (managed services / compose images like `mongo:7`, `bitnami/kafka:3.7`) — never build them into app Dockerfiles. The 4 backend repos each deploy as ONE container from their root Dockerfile.
