#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install.sh — Install the openai-toolkit extension locally.
#
# Copies the compiled extension from individual-packages/openai-toolkit
# into ~/.pi/agent/extensions/openai-toolkit.
#
# Usage:
#   ./scripts/install.sh
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PACKAGE_NAME="openai-toolkit"
PKG_SRC="$REPO_ROOT/dist/package"
INSTALL_DIR="$HOME/.pi/agent/extensions"
INSTALL_TARGET="$INSTALL_DIR/$PACKAGE_NAME"

# ── Colors ───────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  GREEN='\033[0;32m'; CYAN='\033[0;36m'
  YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
else
  GREEN=''; CYAN=''; YELLOW=''; RED=''; NC=''
fi

log()  { printf "${GREEN}[install]${NC} %s\n" "$*"; }
info() { printf "${CYAN}[info]${NC}  %s\n" "$*"; }
warn() { printf "${YELLOW}[warn]${NC}  %s\n" "$*"; }
err()  { printf "${RED}[error]${NC} %s\n" "$*" >&2; }

# ── Pre-flight ───────────────────────────────────────────────────────────
if [ ! -d "$PKG_SRC" ]; then
  err "Package source not found: $PKG_SRC"
  err "Run ./scripts/build.sh first to compile the extension."
  exit 1
fi

if [ ! -f "$PKG_SRC/index.js" ]; then
  err "Compiled bundle not found: $PKG_SRC/index.js"
  err "Run ./scripts/build.sh first to compile the extension."
  exit 1
fi

# ── Install ──────────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"

if [ -d "$INSTALL_TARGET" ]; then
  warn "Removing existing installation at $INSTALL_TARGET"
  rm -rf "$INSTALL_TARGET"
fi

log "Installing $PACKAGE_NAME..."
cp -r "$PKG_SRC" "$INSTALL_TARGET"

# Clean up npm-specific fields from package.json that Pi doesn't need
PACKAGE_JSON="$INSTALL_TARGET/package.json"
if [ -f "$PACKAGE_JSON" ]; then
  sed -e '/"access":/d' -e '/"npm"/d' "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp" && mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"
fi

# ── Done ─────────────────────────────────────────────────────────────────
log "✅ $PACKAGE_NAME installed successfully!"
log "   Location: $INSTALL_TARGET"
echo ""
log "Restart Pi to load the extension."
echo ""
info "To verify:    /llama-swap"
info "To uninstall: rm -rf $INSTALL_TARGET"
echo ""
