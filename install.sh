#!/usr/bin/env bash
set -e

echo "=== OpenCode Config Installer (Linux) ==="

# Check git
if ! command -v git &> /dev/null; then
    echo "Git not found. Install git first."
    exit 1
fi

# Check opencode
if ! command -v opencode &> /dev/null; then
    echo "OpenCode not found."
    echo "Install from: https://opencode.ai/docs/cli"
    echo "Or: curl -fsSL https://opencode.ai/install | bash"
    exit 1
fi

echo "OpenCode version: $(opencode --version 2>&1 | head -1)"

# Check runtime for plugins/MCPs
if command -v bun &> /dev/null; then
    echo "Bun found: $(bun --version)"
elif command -v node &> /dev/null; then
    echo "Node found: $(node --version)"
else
    echo "Warning: No Node/Bun found. Some MCPs/plugins may not work."
fi

# Setup global git config if not set
if [ -z "$(git config --global user.email)" ]; then
    echo ""
    read -p "Git user.email (for commits): " git_email
    git config --global user.email "$git_email"
fi
if [ -z "$(git config --global user.name)" ]; then
    read -p "Git user.name: " git_name
    git config --global user.name "$git_name"
fi

echo ""
echo "=== Next steps ==="
echo "1. Run: opencode auth login"
echo "2. Run: opencode"
echo ""
echo "Config location: $HOME/.config/opencode"
