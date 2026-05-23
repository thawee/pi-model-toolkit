# Lessons Learned

## 1. macOS Bash Compatibility (Associative Arrays)
- **Pattern:** Using `declare -A` for associative arrays fails on macOS default shell because it runs Bash 3.2.57, which does not support associative arrays. Under `set -u`, it produces errors like `unbound variable` when evaluating keys with hyphens (e.g. treated as math expressions like `pi - shared`).
- **Correction:** Avoid `declare -A` in scripts designed to run on macOS. Use standard index-based arrays and helper loop logic for validation instead.

## 2. Compiled Artifact Location for Local Installation
- **Pattern:** Local installation scripts (like `install-package.sh`) copy files directly from source packaging directories (e.g. `individual-packages/pi-openai-sync`). If the compiled JavaScript bundles (e.g. `openai-sync.js`) are only output to `dist/`, they will be missing from the local installation.
- **Correction:** Update the build/bundle scripts (e.g. `build-tgz.sh`) to copy compiled bundles back into the package's source directory (`individual-packages/pi-openai-sync/`) so they are present for local copies as well as remote downloads.

## 3. macOS `sed -i` Requires Empty String Argument
- **Pattern:** `sed -i 's/.../.../'' file` fails on macOS BSD sed with an error like `undefined label`. GNU sed (Linux) allows `sed -i 's/.../.../' file` without the empty string.
- **Correction:** Always use `sed -i '' 's/.../.../' file` (with the empty `''` backup extension argument) in all shell scripts designed to run on macOS.

## 4. Professional Rebranding and Tool Naming Consistency
- **Pattern:** When renaming or rebranding packages/modules, ensure complete removal of old naming references (e.g., `openai_sync`) to prevent legacy baggage, and avoid arbitrary numeric sequencing prefixes like 'Tool X of Y:' which can clutter the UI.
- **Correction:** Keep descriptions, branding headers, and help logs highly professional, concise, and focused on functional descriptions. Rename registered tool names to match rebranded command names (e.g., `openai_server` tool matching `openai-server` command) to maintain structural consistency.
