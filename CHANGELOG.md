# Changelog

All notable changes to the Pi Custom Models Suite extension (`@thawee/pi-model-toolkit`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-23

### Changed

- Renamed `/openai-server` command and extension to `/openai-sync` for clarity.
- Synced internal tool/command identifiers for `/llama-model` to match its new extension name.
- Completely reorganized `README.md` to clearly distinguish the dual workflows provided by `/openai-sync` and `/llama-model`.
- Updated repository URLs across documentation to point to the new `pi-model-toolkit` Github URL.

## [1.0.0] - 2026-05-22

### Added

- Initial release of the Pi Custom Models Suite extension.
- `/openai-sync` slash command for manual model synchronization from OpenAI-compatible APIs.
- `openai_sync` tool for autonomous model synchronization by the agent.
- `/llama-model` slash command for hot-switching and managing models on llama.cpp router servers.
- Support for any OpenAI-compatible `/v1/models` endpoint.
- Automatic detection of reasoning-capable models (e.g., DeepSeek-R1, OpenAI o1).
- Automatic model family classification for optimal formatting.
- Atomic configuration updates to `models.json`.
- Support for custom provider target names.
