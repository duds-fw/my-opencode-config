#Requires -Version 5.1
Write-Host "=== OpenCode Config Installer (Windows) ===" -ForegroundColor Cyan

# Check git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git not found. Install from https://git-scm.com" -ForegroundColor Red
    exit 1
}

# Check opencode
if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
    Write-Host "OpenCode not found." -ForegroundColor Red
    Write-Host "Install from: https://opencode.ai/docs/cli"
    Write-Host "Or use npm: npm i -g opencode-ai"
    exit 1
}

Write-Host "OpenCode version: $(opencode --version 2>&1 | Select-Object -First 1)"

# Check runtime
if (Get-Command bun -ErrorAction SilentlyContinue) {
    Write-Host "Bun found: $(bun --version)"
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "Node found: $(node --version)"
} else {
    Write-Host "Warning: No Node/Bun found. Some MCPs/plugins may not work." -ForegroundColor Yellow
}

# Git config
if (-not (git config --global user.email)) {
    $email = Read-Host "Git user.email (for commits)"
    git config --global user.email $email
}
if (-not (git config --global user.name)) {
    $name = Read-Host "Git user.name"
    git config --global user.name $name
}

Write-Host ""
Write-Host "=== Next steps ===" -ForegroundColor Cyan
Write-Host "1. Run: opencode auth login"
Write-Host "2. Run: opencode"
Write-Host ""
Write-Host "Config location: $env:USERPROFILE\.config\opencode"
