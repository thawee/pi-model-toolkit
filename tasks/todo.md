# Implementation Plan — Bump Version to 1.3.0

## Goal
Bump the project version to `1.3.0` using the version bumper script, compile the final package, run tests, and commit the version changes.

## Tasks
- [ ] Run `./scripts/bump-version.sh 1.3.0` to update the version across all configuration files and code files.
- [ ] Compile the project via `npm run build` and run the test suite to ensure no regressions occur.
- [ ] Commit the version change changes to the repository.
- [ ] Document final results in this todo file.

## Results & Review
1. **package.json:** Updated homepage and repository fields to `https://github.com/thawee/pi-openai-toolkit` (replacing the old `llama-toolkit` references).
2. **install-remote.sh:** Updated `REPO` variable to `"thawee/pi-openai-toolkit"`.
3. **README.md:** Updated git clone URL and CLI install instructions to point to the new `pi-openai-toolkit` repo name.
4. **Code headers:** Updated docstring headers in shared helper files (`shared/format.ts`, `shared/ollama.ts`, `shared/types.ts`) to match.
5. **Verified:** Passed typechecks and test suite (94/94 tests pass).

## Results & Review
1. **Slash Command Rename:** Renamed `/llama-server` (and `/llama-server:<name>`) to `/llama-swap` (and `/llama-swap:<name>`) inside `extensions/openai-sync.ts`. Also added shorthand `/llama-swap` command support for providers matching name `"llama-swap"`.
2. **Fixed Remote Installer:** Corrected `scripts/install-remote.sh` to download the compiled single bundle `index.js` (and `package.json` / `README.md`) instead of seeking legacy multiple source files. Also updated output messages to recommend testing with `/llama-swap`.
3. **Local installer:** Updated `scripts/install.sh` verification information.
4. **Docs updated:** Replaced all references in the `README.md` to `/llama-swap`.
5. **Verified:** Validated and successfully passed all 94/94 tests, zero compiler warnings.
