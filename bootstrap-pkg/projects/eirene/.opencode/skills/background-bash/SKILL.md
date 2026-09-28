---
name: background-bash
description: "Use when the user wants to run long-running commands (builds, tests, deploys, file watchers, servers) without blocking the session. Handles background execution, log capture, and process management."
---

# Background Bash Skill

Run long-running commands in the background without blocking the agent session.

## When to Use

- Build processes (npm build, docker build, terraform apply)
- Test suites (npm test, pytest, go test)
- Development servers (npm run dev, python -m http.server)
- File watchers (nodemon, webpack --watch)
- Deployment operations (kubectl apply, gcloud deploy)
- Any command expected to run > 30 seconds

## How It Works

### 1. Launch Background Command

Use `bash` with `nohup` and redirect output to a log file:

```bash
# Pattern:
nohup <command> > /tmp/opencode-bg/<job-name>.log 2>&1 &
echo "PID: $!"
echo "LOG: /tmp/opencode-bg/<job-name>.log"
```

### 2. Check Status

```bash
# Check if process is still running
ps aux | grep <PID> | grep -v grep

# Check exit code
wait <PID> 2>/dev/null; echo "Exit: $?"

# Read recent log output
tail -20 /tmp/opencode-bg/<job-name>.log
```

### 3. Stop Background Command

```bash
# Graceful stop
kill <PID>

# Force stop
kill -9 <PID>

# Kill entire process group
kill -- -<PGID>
```

## Job Naming Convention

Use descriptive names with timestamps:

```
/build-landing-20260728
/test-console-20260728
/deploy-dev-20260728
/server-admin-20260728
```

## Log Management

- Logs stored in `/tmp/opencode-bg/`
- Auto-cleanup: older than 7 days
- Max log size: 10MB (truncate if larger)

```bash
# Cleanup old logs
find /tmp/opencode-bg/ -name "*.log" -mtime +7 -delete

# Truncate oversized logs
for f in /tmp/opencode-bg/*.log; do
  [ $(stat -c%s "$f" 2>/dev/null || echo 0) -gt 10485760 ] && tail -1000 "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done
```

## Response Pattern

When launching a background job:

```
## Background Job Started

- **Command:** `npm run build`
- **Job ID:** /build-landing-20260728
- **PID:** 12345
- **Log:** /tmp/opencode-bg/build-landing-20260728.log

I'll check back periodically. You can also ask me to:
- `check build-landing` — see current status
- `logs build-landing` — read recent output
- `stop build-landing` — kill the process
```

## Error Handling

- If `nohup` fails, fall back to `&` with explicit log redirect
- If the process exits with non-zero, read the log and report the error
- If the log file doesn't exist, the process may have failed to start
