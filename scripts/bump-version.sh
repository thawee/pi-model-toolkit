#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# bump-version.sh — Bump the version for pi-model-manager.
#
# Updates the version in all relevant files, ensuring consistency.
# Run this BEFORE building to avoid version skew.
#
# Usage:
#   ./scripts/bump-version.sh <new-version>
#
# Example:
#   ./scripts/bump-version.sh 1.4.0
#
# Locations updated:
#   1. VERSION                                  single source of truth
#   2. shared/ollama.ts                         EXTENSION_VERSION constant
#   3. package.json                             root workspace version
#   4. individual-packages/pi-model-manager/package.json
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Parse args ────────────────────────────────────────────────────────────
if [ $# -lt 1 ]; then
  echo "Usage: $0 <new-version>"
  echo ""
  echo "Example: $0 1.4.0"
  exit 1
fi

NEW_VERSION="$1"

# Validate version format (semver)
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+([a-zA-Z0-9.+-]*)?$'; then
  echo "Error: Invalid version format '$NEW_VERSION'"
  echo "Expected: MAJOR.MINOR.PATCH (e.g., 1.4.0)"
  exit 1
fi

# ── Colors ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  GREEN=''; CYAN=''; NC=''
fi

log()  { printf "${GREEN}[bump]${NC} %s\n" "$*"; }
info() { printf "${CYAN}[info]${NC}  %s\n" "$*"; }

# ── Detect current version ────────────────────────────────────────────────
if [ ! -f "$REPO_ROOT/VERSION" ]; then
  echo "Error: VERSION file not found at $REPO_ROOT/VERSION"
  exit 1
fi
CURRENT_VERSION="$(tr -d '[:space:]' < "$REPO_ROOT/VERSION")"

if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
  echo "Already at version $NEW_VERSION — nothing to do."
  exit 0
fi

echo ""
echo "  ⚡ pi-model-manager — Version Bumper"
echo ""
info "Current: $CURRENT_VERSION"
info "New:     $NEW_VERSION"
echo ""

# ── 1. VERSION file ──────────────────────────────────────────────────────
log "Updating VERSION"
echo "$NEW_VERSION" > "$REPO_ROOT/VERSION"

# ── 2. shared/ollama.ts — EXTENSION_VERSION constant ─────────────────────
if [ -f "$REPO_ROOT/shared/ollama.ts" ]; then
  log "Updating shared/ollama.ts"
  sed -i '' "s/export const EXTENSION_VERSION = \"[^\"]*\"/export const EXTENSION_VERSION = \"$NEW_VERSION\"/" \
    "$REPO_ROOT/shared/ollama.ts"
fi

# ── 3. Root package.json ──────────────────────────────────────────────────
log "Updating package.json"
sed -i '' 's/"version": "[0-9]*\.[0-9]*\.[0-9]*[a-zA-Z0-9.+-]*"/"version": "'"$NEW_VERSION"'"/' \
  "$REPO_ROOT/package.json"



# ── 5. README.md — version badge ─────────────────────────────────────────
if [ -f "$REPO_ROOT/README.md" ]; then
  log "Updating README.md"
  sed -i '' "s/Version-v$CURRENT_VERSION/Version-v$NEW_VERSION/" "$REPO_ROOT/README.md" 2>/dev/null || true
fi

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
log "✅ Version bumped: $CURRENT_VERSION → $NEW_VERSION"
echo ""
info "Next steps:"
info "  1. Review:  git diff"
info "  2. Build:   ./scripts/build.sh"
info "  3. Commit:  git add -A && git commit -m \"v$NEW_VERSION\""
echo ""