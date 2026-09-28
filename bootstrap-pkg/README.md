# OpenCode Machine Bootstrap

Paket sekali-jalan untuk mereplikasi setup opencode machine A ke machine B.

## Isi Paket

```
bootstrap-pkg/
├── bootstrap.sh            # Installer (jalankan sebagai root)
├── config/                 # ~/.config/opencode (agents, plugins, skills, config)
│   ├── opencode.jsonc      # config utama (MCP, agents, commands, permission)
│   ├── agent/              # 7 agent definitions
│   ├── plugins/            # graphify.js, rtk.ts, opencode-plugin.js (pixel-agents)
│   └── skills/graphify/    # skill knowledge graph
├── projects/               # /home/projects + /home/eirene (AGENTS.md, agents, skills)
├── infra/                  # /opt/opencode-proxy + systemd units (5 service)
└── pixel-agents-hooks/     # ~/.pixel-agents config + claude hook
```

## Cara Pakai (machine B)

```bash
sudo bash bootstrap.sh --password='RAHASIA_BARU'
```

Opsional:
- `--dry-run`  : simulasikan tanpa eksekusi
- `--skip-apt` : lewati cek apt
- Password default: `__OPENCODE_PASSWORD__` (SAMA DENGAN machine A — GANTI!)

## Prasyarat machine B

- Ubuntu 24.04+, Node.js v20+ (`node --version`), git
- Root/sudo tanpa prompt (atau sudoers NOPASSWD)

## Setelah install

1. Verifikasi: `opencode --version` → 1.18.18
2. Health check: 4096/4097/4098/3100/8080 harus HTTP 200
3. Model untuk sub-agent yang terbukti jalan:
   `opencode run --model openrouter/~deepseek/deepseek-v4-flash-latest`
4. Blue-green restart tanpa downtime: `sudo /opt/opencode-proxy/restart.sh`

## Catatan

- **Hardening**: sesuai machine A, `curl`→`rcurl` dan `wget`→`rwget` (otomatis
  jika curl ada). Semua script dalam paket sudah memakai `rcurl`.
- **Tidak disalin**: token auth providers, DB sesi (opencode.db), state pixel-agents
  (server.json di-generate ulang saat service start).
- Dokumen analisis lengkap: `opencode-capability-map.md` (di repo ini).