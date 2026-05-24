#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install-remote.sh — Install pi-model-manager from GitHub.
#
# Downloads the compiled extension files directly from the GitHub repository
# and installs them into ~/.pi/agent/extensions/pi-model-manager.
#
# Usage:
#   ./scripts/install-remote.sh [branch]
#
# Examples:
#   ./scripts/install-remote.sh          # install from main branch
#   ./scripts/install-remote.sh v1.3.5   # install from a version tag
# ---------------------------------------------------------------------------
set -euo pipefail

PACKAGE_NAME="pi-model-manager"
BRANCH="${1:-main}"
REPO="thawee/pi-model-manager"
RAW_BASE="https://raw.githubusercontent.com/$REPO/$BRANCH/individual-packages/$PACKAGE_NAME"
INSTALL_DIR="$HOME/.pi/agent/extensions"
INSTALL_TARGET="$INSTALL_DIR/$PACKAGE_NAME"
TEMP_DIR="$(mktemp -d)"

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

# ── Cleanup on exit ──────────────────────────────────────────────────────
cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT

# ── Pre-flight ───────────────────────────────────────────────────────────
if ! command -v curl &>/dev/null; then
  err "curl is required but not installed."
  exit 1
fi

# ── Download ─────────────────────────────────────────────────────────────
log "Downloading $PACKAGE_NAME from $REPO ($BRANCH)..."

# Files to download
FILES=("package.json" "openai-sync.js" "llama-model.js" "README.md")

for file in "${FILES[@]}"; do
  url="$RAW_BASE/$file"
  info "  Fetching $file..."
  if ! curl -fsSL "$url" -o "$TEMP_DIR/$file" 2>/dev/null; then
    if [ "$file" = "README.md" ]; then
      warn "  $file not found — skipping (optional)"
    else
      err "  Failed to download: $url"
      exit 1
    fi
  fi
done

# ── Install ──────────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"

if [ -d "$INSTALL_TARGET" ]; then
  warn "Removing existing installation at $INSTALL_TARGET"
  rm -rf "$INSTALL_TARGET"
fi

mkdir -p "$INSTALL_TARGET"
cp "$TEMP_DIR"/package.json "$INSTALL_TARGET/"
cp "$TEMP_DIR"/openai-sync.js "$INSTALL_TARGET/"
[ -f "$TEMP_DIR/llama-model.js" ] && cp "$TEMP_DIR/llama-model.js" "$INSTALL_TARGET/"
[ -f "$TEMP_DIR/README.md" ] && cp "$TEMP_DIR/README.md" "$INSTALL_TARGET/"

# Clean up npm-specific fields from package.json that Pi doesn't need
PACKAGE_JSON="$INSTALL_TARGET/package.json"
sed -e '/"access":/d' -e '/"npm"/d' "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp" && mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"

# ── Done ─────────────────────────────────────────────────────────────────
log "✅ $PACKAGE_NAME installed successfully!"
log "   Location: $INSTALL_TARGET"
echo ""
log "Restart Pi to load the extension."
echo ""
info "To verify:    /openai-sync --help"
info "To verify:    /llama-model"
info "To uninstall: rm -rf $INSTALL_TARGET"
echo ""
