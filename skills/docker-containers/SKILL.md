---
name: docker-containers
description: "Containerise the Virtual Office only when justified: secret handling, read-only filesystem, state volumes, layer order and a verified build — plus why this repo needs no container."
---

# Docker Containers

## Does this project need a container?

**No — and building one today would be a regression.** The facts:

- Zero runtime dependencies. One Node process (`server.js`).
- The service is already managed: `virtual-office.service`,
  `ExecStart=/usr/local/bin/node /home/opencode/virtual-office/server.js`,
  `WorkingDirectory=/home/opencode/virtual-office`.
- `docker` is **not installed** on this machine. There is no `Dockerfile`, no
  `.dockerignore`, no image registry, and no deployment target that expects
  a container.

Adding a container would add a base image, a layer cache, a volume, a
network boundary and a second process supervisor — to package something that
already runs correctly under systemd.

What would actually justify one: the office must run somewhere that is not
this host (a shared runner, a colleague's laptop, an ephemeral sandbox), or
the deployment must be reproducible from a single artefact.

## If a container is used, these are the requirements

### Secrets

`state/client.json` holds the owner bot token. It must **never** be baked
into the image or its layer history — not as an `ENV`, not as a `COPY`ed
file, not in a build arg (build args land in history). Mount it at runtime
or inject it from the environment of the running container.

Verify: `docker history <image>` must show no secret. If it does, the image
is compromised — delete it, fix the Dockerfile, rebuild. A secret in a
published layer cannot be removed by a later `RUN rm`.

### Filesystem

- Run as a **non-root user**. No `USER root`.
- **Read-only root filesystem** for everything except `state/`, which is a
  volume.
- `state/` on a named volume or a bind mount. It is the office's live state
  and the server rewrites it on every tick.
- No writable path that persists between runs except `state/`.

### Build hygiene

- **Pin the base image by digest**, not by a floating tag. `FROM node:20`
  changes under you.
- Copy the manifest before the source so dependency layers cache. There is no
  manifest today, so this is a plain `COPY` — keep that order anyway if a
  manifest is ever added.
- Add a `.dockerignore` excluding at least `state/`, `.git/`, `node_modules/`,
  `graphify-out/` and any `*.log`. `state/` in the build context is a secret
  leak waiting to happen.
- Keep the build reproducible: same inputs, same image.

### Health

The container's health check must reflect the service's **actual** health
endpoint, not "the process is up". The office exposes
`GET /api/agency/health`. Verify it returns what you expect when the
container is healthy, and that a stopped-but-running container fails it.

## Verify the build — never assume it

```bash
docker build -t virtual-office:verify .
docker run --rm -p <port>:<port> virtual-office:verify
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<port>/api/agency/health
```

A Dockerfile that was never run is a hypothesis, not a deliverable.

## Outputs

Report the base image and whether it is digest-pinned, the user the
container runs as, the read-only and volume configuration, what
`docker history` showed about secrets, the health-check result, and any
requirement you could not satisfy.

## Common mistakes

- `COPY . .` with a `.dockerignore` that forgot `state/` — that ships the
  owner bot token.
- Passing a secret as a build arg.
- Running as root.
- No health check, so a dead container looks alive.
- Building an image for a service that systemd already runs, with no
  identified benefit.
