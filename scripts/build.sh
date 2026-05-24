#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build.sh — Build the pi-model-toolkit extension.
#
# Compiles TypeScript → bundled JavaScript and packs it into a .tgz tarball.
# ---------------------------------------------------------------------------
set -euo pipefail

# ── Paths ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$REPO_ROOT/dist"
EXT_SRC="$REPO_ROOT/extensions/index.ts"

# ── Version ──────────────────────────────────────────────────────────────
if [ ! -f "$REPO_ROOT/VERSION" ]; then
  echo "ERROR: VERSION file not found at $REPO_ROOT/VERSION" >&2
  exit 1
fi
VERSION="$(tr -d '[:space:]' < "$REPO_ROOT/VERSION")"

# ── Colors ───────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  GREEN='\033[0;32m'; CYAN='\033[0;36m'
  YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
else
  GREEN=''; CYAN=''; YELLOW=''; RED=''; NC=''
fi

log()  { printf "${GREEN}[build]${NC} %s\n" "$*"; }
info() { printf "${CYAN}[info]${NC}  %s\n" "$*"; }
warn() { printf "${YELLOW}[warn]${NC}  %s\n" "$*" >&2; }
err()  { printf "${RED}[error]${NC} %s\n" "$*" >&2; }

# ── Locate esbuild ───────────────────────────────────────────────────────
ESBUILD=""
if [ -x "$REPO_ROOT/node_modules/.bin/esbuild" ]; then
  ESBUILD="$REPO_ROOT/node_modules/.bin/esbuild"
elif command -v esbuild &>/dev/null; then
  ESBUILD="$(command -v esbuild)"
elif command -v npx &>/dev/null; then
  ESBUILD="npx --yes esbuild"
else
  err "esbuild not found. Install via npm install --save-dev esbuild"
  exit 1
fi

# ── Pre-flight ───────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  err "Node.js not found. Please install Node.js >= 18."
  exit 1
fi

# ── Clean & Init ─────────────────────────────────────────────────────────
log "Cleaning previous build..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ── Bundle ───────────────────────────────────────────────────────────────
log "Building @thawee/pi-model-toolkit v${VERSION}"
TARGET_DIR="$BUILD_DIR/package"
mkdir -p "$TARGET_DIR"

# Build index
$ESBUILD "$EXT_SRC" \
  --bundle \
  --format=esm \
  --target=es2020 \
  --platform=node \
  --external:@mariozechner/* \
  --external:@earendil-works/* \
  --external:typebox \
  --external:path \
  --external:fs \
  --external:os \
  --outfile="$TARGET_DIR/index.js"

js_size="$(wc -c < "$TARGET_DIR/index.js")"
info "  index.ts -> index.js  ($(numfmt --to=iec "$js_size" 2>/dev/null || echo "${js_size}B"))"


# ── Package JSON ─────────────────────────────────────────────────────────
# Read root package.json, clean it up for distribution
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("'"$REPO_ROOT"'/package.json", "utf8"));
pkg.version = "'"$VERSION"'";
delete pkg.scripts;
delete pkg.devDependencies;
pkg.main = "index.js";
pkg.type = "module";
pkg.pi = { extensions: ["./index.js"] };
pkg.peerDependencies = { "@earendil-works/pi-coding-agent": ">=0.66" };
fs.writeFileSync("'"$TARGET_DIR"'/package.json", JSON.stringify(pkg, null, 2) + "\n");
'

# ── README ───────────────────────────────────────────────────────────────
[ -f "$REPO_ROOT/README.md" ] && cp "$REPO_ROOT/README.md" "$TARGET_DIR/README.md"

# ── Tarball ──────────────────────────────────────────────────────────────
TFILE="pi-model-toolkit-${VERSION}.tgz"
(cd "$TARGET_DIR" && tar -czf "$BUILD_DIR/$TFILE" *)

log "ok @thawee/pi-model-toolkit v${VERSION} -> $BUILD_DIR/$TFILE"
echo ""
log "Build complete!"
echo ""
echo "  Output directory: $BUILD_DIR/"
echo "  Package built:    $TFILE  ($(numfmt --to=iec "$(wc -c < "$BUILD_DIR/$TFILE")" 2>/dev/null || echo "$(wc -c < "$BUILD_DIR/$TFILE")B"))"
echo ""
info "Install locally:"
info "  ./scripts/install.sh"
echo ""
