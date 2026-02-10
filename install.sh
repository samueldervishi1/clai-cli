#!/bin/bash
set -e

INSTALL_DIR="$HOME/.clai"
REPO_URL="https://github.com/samueldervishi1/clai-cli.git"
BIN_DIR="$HOME/.local/bin"

echo ""
echo "  Installing Clai..."
echo ""

# Check for Node.js
if ! command -v node &>/dev/null; then
  echo "  Error: Node.js is required (v22+). Install it first."
  exit 1
fi

# Check for pnpm (fall back to npm)
if command -v pnpm &>/dev/null; then
  PKG_MGR="pnpm"
elif command -v npm &>/dev/null; then
  PKG_MGR="npm"
else
  echo "  Error: pnpm or npm is required."
  exit 1
fi

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
  echo "  Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --quiet
else
  echo "  Cloning repository..."
  git clone --quiet "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install dependencies and build
echo "  Installing dependencies..."
$PKG_MGR install --silent 2>/dev/null

echo "  Building..."
$PKG_MGR run build --silent 2>/dev/null

# Make entry point executable
chmod +x dist/index.js

# Create bin directory and symlink
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/dist/index.js" "$BIN_DIR/clai"

echo ""
echo "  Clai installed to $INSTALL_DIR"
echo "  Binary linked at $BIN_DIR/clai"
echo ""

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "  Add this to your ~/.bashrc or ~/.zshrc:"
  echo ""
  echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
  echo "  Then restart your terminal or run: source ~/.bashrc"
  echo ""
else
  echo "  Run 'clai' to start chatting!"
  echo ""
fi
