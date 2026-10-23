# my-opencode-config

Portable OpenCode V2 configuration synced across Linux and Windows.

## Setup

### Linux/macOS
```bash
git clone https://github.com/duds-fw/my-opencode-config ~/.config/opencode
```

### Windows (native PowerShell)
```powershell
git clone https://github.com/duds-fw/my-opencode-config "$env:USERPROFILE\.config\opencode"
```

### Windows (WSL2)
Same as Linux - clone into `~/.config/opencode` inside WSL.

## Structure

```
~/.config/opencode/
├── opencode.jsonc     # Global V2 config
├── cli.json            # TUI settings (replaces tui.json)
├── AGENTS.md           # Global instructions
├── agents/             # Agent definitions (.md with frontmatter)
├── commands/           # Slash commands (.md)
├── skills/             # Skills (each in subdir with SKILL.md)
├── plugins/            # Plugins
├── local/              # Machine-specific (gitignored)
└── install.sh/ps1      # Setup scripts
```

## After cloning

1. Run `./install.sh` (Linux) or `.\install.ps1` (Windows) to install dependencies
2. Run `opencode auth login` to authenticate with providers
3. Start with `opencode`

## Secrets

Never commit API keys. Use `{env:VAR_NAME}` in config or put in `local/`. Provider auth goes in `~/.local/share/opencode/auth.json` (managed by `opencode auth`).
