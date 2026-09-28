#!/bin/bash
# OpenCode Blue-Green Restart (Graceful)
# Usage: /opt/opencode-proxy/restart.sh [--dry-run]
#
# Flow:
# 1. Read config → get active & standby ports
# 2. Save session ID for continuation
# 3. Start standby instance
# 4. Health check until healthy
# 5. Atomic config swap
# 6. Verify proxy routing
# 7. Write continue flag for wrapper
# 8. Restart old instance
# 9. Done

set -euo pipefail

CONFIG="/opt/opencode-proxy/config.json"
CONTINUE_FLAG="/opt/opencode-proxy/.continue"
RESTART_LOCK="/opt/opencode-proxy/.restart-lock"
LOG_PREFIX="[RESTART]"
DRY_RUN=false
HEALTH_TIMEOUT=30

# Acquire restart lock (prevents proxy health check failover during restart)
cleanup() { rm -f "$RESTART_LOCK"; }
trap cleanup EXIT
echo "true" > "$RESTART_LOCK"

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

log() { echo "$(date '+%H:%M:%S') $LOG_PREFIX $*"; }
err() { echo "$(date '+%H:%M:%S') $LOG_PREFIX ERROR: $*" >&2; }

# --- Step 1: Read config ---
log "Step 1: Reading config..."
if [[ ! -f "$CONFIG" ]]; then
    err "Config not found: $CONFIG"
    exit 1
fi

ACTIVE_PORT=$(python3 -c "import json; print(json.load(open('$CONFIG'))['activePort'])")
STANDBY_PORT=$(python3 -c "import json; print(json.load(open('$CONFIG'))['standbyPort'])")

if [[ "$ACTIVE_PORT" -eq 4097 ]]; then
    ACTIVE_SERVICE="opencode"
    STANDBY_SERVICE="opencode2"
else
    ACTIVE_SERVICE="opencode2"
    STANDBY_SERVICE="opencode"
fi

log "  Active: $ACTIVE_PORT ($ACTIVE_SERVICE) | Standby: $STANDBY_PORT ($STANDBY_SERVICE)"

# --- Step 2: Save session ID for continuation ---
log "Step 2: Saving session ID for continuation..."
SESSION_ID=$(rcurl -sf -u "opencode:__OPENCODE_PASSWORD__" --connect-timeout 2 "http://127.0.0.1:$ACTIVE_PORT/session" 2>/dev/null | python3 -c "
import json, sys
try:
    sessions = json.load(sys.stdin)
    # Find latest session in /home/projects (not subagent sessions)
    for s in sessions:
        if s.get('directory','').rstrip('/').endswith('projects') and not s.get('parentID'):
            print(s['id']); break
    else:
        if sessions: print(sessions[0]['id'])
except: pass
" 2>/dev/null || echo "")

if [[ -n "$SESSION_ID" ]]; then
    log "  Session ID: $SESSION_ID"
else
    log "  No session found — will still restart"
fi

if $DRY_RUN; then
    log "DRY RUN — would start $STANDBY_SERVICE on port $STANDBY_PORT"
    log "DRY RUN — would swap config + write continue flag + restart $ACTIVE_SERVICE"
    log "DRY RUN done. No changes made."
    exit 0
fi

# --- Step 3: Start standby instance ---
log "Step 3: Starting $STANDBY_SERVICE on port $STANDBY_PORT..."
sudo systemctl start "$STANDBY_SERVICE"
log "  $STANDBY_SERVICE started ✅"

# --- Step 4: Health check standby instance ---
log "Step 4: Waiting for $STANDBY_SERVICE to be healthy (max ${HEALTH_TIMEOUT}s)..."
ELAPSED=0
HEALTHY=false
while [[ $ELAPSED -lt $HEALTH_TIMEOUT ]]; do
    if rcurl -sf -o /dev/null -u "opencode:__OPENCODE_PASSWORD__" --connect-timeout 2 "http://127.0.0.1:$STANDBY_PORT/" 2>/dev/null; then
        HEALTHY=true
        break
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
    [[ $((ELAPSED % 5)) -eq 0 ]] && log "  Still waiting... (${ELAPSED}s)"
done

if ! $HEALTHY; then
    err "$STANDBY_SERVICE failed to start within ${HEALTH_TIMEOUT}s"
    sudo systemctl stop "$STANDBY_SERVICE"
    exit 1
fi
log "  $STANDBY_SERVICE healthy ✅ (${ELAPSED}s)"

# --- Step 5: Atomic config swap ---
log "Step 5: Atomic config swap..."
python3 -c "
import json
with open('$CONFIG', 'r') as f: cfg = json.load(f)
cfg['activePort'] = $STANDBY_PORT
cfg['standbyPort'] = $ACTIVE_PORT
with open('$CONFIG', 'w') as f: json.dump(cfg, f, indent=2)
"
log "  Config swapped: active=$STANDBY_PORT ($STANDBY_SERVICE), standby=$ACTIVE_PORT ($ACTIVE_SERVICE)"

# --- Step 6: Verify proxy routes to new instance ---
log "Step 6: Verifying proxy routing..."
sleep 1
if rcurl -sf -o /dev/null -u "opencode:__OPENCODE_PASSWORD__" --connect-timeout 3 "http://127.0.0.1:4096/" 2>/dev/null; then
    log "  Proxy routing to new instance ✅"
else
    err "Proxy routing check failed — but continuing"
fi

# --- Step 7: Write continue flag ---
log "Step 7: Writing continue flag..."
if [[ -n "$SESSION_ID" ]]; then
    echo "{\"sessionId\":\"$SESSION_ID\",\"timestamp\":$(date +%s)}" > "$CONTINUE_FLAG"
    log "  Continue flag written ✅ (session=$SESSION_ID)"
else
    log "  No session ID — skipping continue flag"
fi

# --- Step 8: Restart old instance (fresh for next restart) ---
log "Step 8: Waiting for proxy to settle..."
sleep 3

# IMPORTANT:
# If this script is triggered from the currently active OpenCode service,
# doing `systemctl restart $ACTIVE_SERVICE` inline can terminate this script
# mid-flight (same cgroup), leaving flow incomplete.
#
# Run restart in a detached transient unit so this script can finish cleanly.
log "Step 9: Scheduling detached restart for $ACTIVE_SERVICE..."
RESTART_UNIT="opencode-delayed-restart-$(date +%s)"
sudo systemd-run \
  --unit "$RESTART_UNIT" \
  --collect \
  --service-type=oneshot \
  /bin/systemctl restart "$ACTIVE_SERVICE" >/dev/null
log "  $ACTIVE_SERVICE restart scheduled ✅ (unit=$RESTART_UNIT)"

# --- Step 10: Done ---
log ""
log "=== RESTART COMPLETE ==="
log "  Active:   $STANDBY_PORT ($STANDBY_SERVICE)"
log "  Standby:  $ACTIVE_PORT ($ACTIVE_SERVICE)"
log "  Continue: wrapper will auto-continue session $SESSION_ID"
