#!/usr/bin/env bash
# ⚡ build.sh — Setup, build, and install pi-focus extensions

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ───────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  GREEN=''; CYAN=''; NC=''
fi

log()  { printf "\n${GREEN}%s${NC}\n" "$*"; }
info() { printf "\n${CYAN}%s${NC}\n" "$*"; }

log "⚡ Setting up, building, and installing pi-focus extensions..."

# 1. Setup (Install dependencies)
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  info "[1/4] Installing dependencies..."
  cd "$PROJECT_DIR"
  npm install
else
  info "[1/4] Dependencies already installed, skipping setup..."
fi

# 2. Type Check
info "[2/4] Type checking..."
cd "$PROJECT_DIR"
npx tsc

# 3. Build (Bundle)
info "[3/4] Bundling extension..."
./scripts/build.sh

# 4. Install
info "[4/4] Installing to ~/.pi/agent/extensions..."
./scripts/install.sh

log "✔ All done!"
