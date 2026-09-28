#!/usr/bin/env bash
# =============================================================================
# OpenCode Machine Bootstrap — replicate a full opencode setup to a new machine
# -----------------------------------------------------------------------------
# Source : machine A (opencode v1.18.18, Ubuntu 24.04)
# Usage  : sudo bash bootstrap.sh [--password=MY_SECRET] [--skip-apt] [--dry-run]
#
# What it installs:
#   1. Core binaries (opencode, MCP servers, rtk, graphify, gk)
#   2. Global config  (~/.config/opencode/  : agents, plugins, skills, tui)
#   3. Project config (/home/projects, /home/eirene)
#   4. Infra          (opencode.web 4097/4098 + proxy 4096 + pixel-agents 3100)
#   5. systemd units  (5 services)
#   6. Bash aliases   (rtk/graphify/git)
#
# NOTE : mirrors machine A hardening — curl/wget are RENAMED to rcurl/rwget.
# =============================================================================
set -euo pipefail

PASSWORD="${OPENCODE_PASSWORD:-__OPENCODE_PASSWORD__}"          # default: bisa di-override
DRY_RUN=false
SKIP_APT=false
OPCODE_VER="1.18.18"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for arg in "$@"; do
  case "$arg" in
    --password=*) PASSWORD="${arg#*=}" ;;
    --skip-apt)   SKIP_APT=true ;;
    --dry-run)    DRY_RUN=true ;;
  esac
done

log()  { echo -e "\033[1;32m[BOOT]\033[0m $*"; }
warn() { echo -e "\033[1;33m[BOOT]\033[0m WARN: $*"; }
die()  { echo -e "\033[1;31m[BOOT]\033[0m ERROR: $*" >&2; exit 1; }
run()  { if $DRY_RUN; then echo "    DRY: $*"; else "$@"; fi }

[[ $EUID -eq 0 ]] || die "jalankan sebagai root (sudo bash bootstrap.sh)"

# ---------------------------------------------------------------------------
# STEP 1 — Core binaries
# ---------------------------------------------------------------------------
log "STEP 1: Core binaries (opencode $OPCODE_VER + MCP + tools)"

if ! command -v node >/dev/null; then
  die "Node.js v20+ dibutuhkan. Install dulu: apt install -y nodejs npm (atau nvm)."
fi

if ! command -v rcurl >/dev/null && command -v curl >/dev/null; then
  log "  Hardening: rename curl→rcurl, wget→rwget (mengikuti machine A)"
  run mv /usr/bin/curl /usr/bin/rcurl
  run mv /usr/bin/wget /usr/bin/rwget || true
fi

run npm install -g "opencode-ai@$OPCODE_VER"
run npm install -g \
    @modelcontextprotocol/server-filesystem \
    @modelcontextprotocol/server-memory \
    @modelcontextprotocol/server-sequential-thinking \
    @gitkraken/gk \
    @cocaxcode/database-mcp \
    mcp-docker-server ssh-mcp android-mcp-server playwright

# rtk (token-saving CLI) — coba via cargo, fallback skips
if ! command -v rtk >/dev/null; then
  warn "rtk tidak terpasang. Install manual: cargo install rtk (atau binary release v0.42.4)."
fi

# graphify (knowledge graph) — via uv
if ! command -v graphify >/dev/null; then
  warn "graphify tidak terpasang. Install: uv tool install graphify@0.9.26 dan mcp-server-git."
fi

log "  OK: opencode $(opencode --version 2>/dev/null || echo '?')"

# ---------------------------------------------------------------------------
# STEP 2 — Global config: ~/.config/opencode
# ---------------------------------------------------------------------------
log "STEP 2: Global config -> \$HOME/.config/opencode"

# HOME kadang kosong di sesi opencode shell — fallback ke /root (root user)
if [[ -z "${HOME:-}" ]]; then
  HOME="/root"
fi
CONF="$HOME/.config/opencode"
run mkdir -p "$CONF/agent" "$CONF/plugins" "$CONF/skills"

# Salin file (dari folder paket ini)
if [[ -d "$SRC_DIR/config" ]]; then
  run cp "$SRC_DIR/config/opencode.jsonc" "$CONF/"
  run cp "$SRC_DIR/config/tui.json"      "$CONF/"
  run cp "$SRC_DIR/config/package.json"  "$CONF/"
  run cp "$SRC_DIR/config/.gitignore"    "$CONF/"
  run cp "$SRC_DIR/config/opencode-synced.jsonc" "$CONF/" 2>/dev/null || true
  run cp "$SRC_DIR/config/agent/"*".md"  "$CONF/agent/"
  run cp "$SRC_DIR/config/plugins/"*     "$CONF/plugins/"
  run cp -r "$SRC_DIR/config/skills/"*   "$CONF/skills/"
fi

# Subst password placeholder -> nilai aktual
run sed -i "s/__OPENCODE_PASSWORD__/$PASSWORD/g" "$CONF/opencode.jsonc" 2>/dev/null || true

# Deps plugin (opencode-synced, plugin SDK)
if [[ -d "$SRC_DIR/config" && -f "$SRC_DIR/config/package.json" ]]; then
  (cd "$CONF" && run npm install --no-audit --no-fund)
fi

log "  OK: $(ls "$CONF/agent/"*.md 2>/dev/null | wc -l) agents, $(ls "$CONF/plugins/" 2>/dev/null | wc -l) plugins"

# ---------------------------------------------------------------------------
# STEP 3 — Project config (/home/projects + /home/eirene)
# ---------------------------------------------------------------------------
log "STEP 3: Project config"

run mkdir -p /home/projects /home/eirene
[[ -d "$SRC_DIR/projects" ]] && run cp -r "$SRC_DIR/projects/." /home/projects/ 2>/dev/null || true

# Eirene terpisah (referensi path)
if [[ -d "$SRC_DIR/projects/eirene" ]]; then
  run cp -r "$SRC_DIR/projects/eirene/." /home/eirene/
fi

# ---------------------------------------------------------------------------
# STEP 4 — Infra: blue-green proxy + services
# ---------------------------------------------------------------------------
log "STEP 4: Infra (/opt/opencode-proxy)"

run mkdir -p /opt/opencode-proxy
[[ -d "$SRC_DIR/infra" ]] && run cp -r "$SRC_DIR/infra/." /opt/opencode-proxy/

# Config default proxy
run python3 - <<'PY'
import json, os
cfg_path = "/opt/opencode-proxy/config.json"
with open(cfg_path) as f:
    cfg = json.load(f)
cfg.setdefault("activePort", 4097)
cfg.setdefault("standbyPort", 4098)
with open(cfg_path, "w") as f:
    json.dump(cfg, f, indent=2)
PY

# Subst password di server.mjs / restart.sh
run sed -i "s/__OPENCODE_PASSWORD__/$PASSWORD/g" /opt/opencode-proxy/server.mjs
run sed -i "s/__OPENCODE_PASSWORD__/$PASSWORD/g" /opt/opencode-proxy/restart.sh
run chmod +x /opt/opencode-proxy/restart.sh

# Deps proxy
(cd /opt/opencode-proxy && run npm install --no-audit --no-fund)

# ---------------------------------------------------------------------------
# STEP 5 — systemd services
# ---------------------------------------------------------------------------
log "STEP 5: systemd services (opencode, opencode2, proxy, pixel-agents, ai-dashboard)"

if [[ -d "$SRC_DIR/infra" ]]; then
  for unit in opencode opencode2 opencode-proxy pixel-agents ai-dashboard; do
    if [[ -f "$SRC_DIR/infra/$unit.service" ]]; then
      run cp "$SRC_DIR/infra/$unit.service" "/etc/systemd/system/"
      run sed -i "s/__OPENCODE_PASSWORD__/$PASSWORD/g" "/etc/systemd/system/$unit.service"
    fi
  done
  run systemctl daemon-reload
  run systemctl enable --now opencode.service opencode2.service \
        opencode-proxy.service pixel-agents.service ai-dashboard.service
fi

# ---------------------------------------------------------------------------
# STEP 6 — Bash aliases & PATH
# ---------------------------------------------------------------------------
log "STEP 6: Bash aliases (rtk/graphify/git) + PATH"

if ! grep -q 'alias rk=' "$HOME/.bashrc" 2>/dev/null; then
  cat >> "$HOME/.bashrc" <<'BASHRC'

# ---- opencode bootstrap (machine A parity) ----
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
alias rk='rtk'
alias rkg='rtk graphify'
alias gph='graphify'
alias gphq='graphify query'
alias gphu='graphify update'
alias proj='cd /home/projects'
export HOME=/root
BASHRC
  log "  .bashrc aliases ditambahkan"
fi

# ---------------------------------------------------------------------------
# STEP 7 — Validasi
# ---------------------------------------------------------------------------
log "STEP 7: Validasi"
if ! $DRY_RUN; then
  sleep 3
  for port in 4096 4097 4098 3100 8080; do
    code=$(rcurl -s -o /dev/null -w '%{http_code}' -u "opencode:$PASSWORD" \
           --connect-timeout 2 "http://127.0.0.1:$port/" 2>/dev/null || echo "000")
    echo "    port $port -> HTTP $code"
  done
else
  echo "    (dry-run: validasi dilewati)"
fi

log "SELESAI. Buka http://<host>:4096 (proxy) atau mulai sesi: opencode"
log "Model agent terverifikasi: opencode run --model openrouter/~deepseek/deepseek-v4-flash-latest"