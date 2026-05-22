# ⚡ Pi OpenAI Sync

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Pi Version](https://img.shields.io/badge/Pi-v0.66%2B-green.svg)](https://github.com/badlogic/pi-mono)
[![GitHub Repository](https://img.shields.io/badge/GitHub-thawee%2Fpi--openai--sync-darkviolet.svg)](https://github.com/thawee/pi-openai-sync)
[![Version](https://img.shields.io/badge/Version-v1.0.0-orange.svg)](VERSION)

An advanced model synchronization extension for [Pi Coding Agent](https://github.com/badlogic/pi-mono). It lets you dynamically fetch, auto-classify, and sync available models from any OpenAI-compatible API (e.g., Ollama, llama.cpp, DeepInfra, Together AI, OpenRouter, DeepSeek, Groq, or your own local/custom gateways) directly into your Pi `models.json` configuration file.

---

## 🌟 Key Features

* **⚡ One-Click Synchronization**: Dynamically query any OpenAI-compatible `/v1/models` endpoint and sync available models into Pi.
* **🧠 Reasoning Model Auto-Detection**: Automatically identifies reasoning/thinking models (e.g., DeepSeek-R1, OpenAI o1/o3-mini, reasoning Qwen/Llama variants) and flags them with `"reasoning": true` so Pi knows how to interact with them correctly.
* **🏷️ Model Family Classification**: Auto-detects model families (such as DeepSeek, Claude, Llama, Qwen, GPT, Gemini, Mistral) based on the model ID for optimal prompt and token formatting.
* **🔒 Atomic Config Updates**: Safe, transactional read-modify-write actions on `models.json` with built-in retry mechanisms to avoid race conditions.
* **🛠️ Dual Interface**: Features both a convenient slash command (`/openai-sync`) and a registered agent tool (`openai_sync`) so the agent can discover and sync new models autonomously.
* **🎨 Custom Target Providers**: Customize the target provider key in `models.json` (e.g., `deepinfra`, `together`, `local-gw`) rather than overwriting your standard `"openai"` configuration.

---

## 📦 Installation

### 1. Simple Pi Package Command (Recommended)

To install the extension directly into your Pi Coding Agent workspace, execute:

```bash
pi install git:github.com/thawee/pi-openai-sync
```

Pi will clone the repository, automatically discover the extension in the `extensions/` directory, and register it. Reload Pi to activate.

### 2. Manual Directory Installation

If you prefer to install files manually:

1. Copy the compiled JavaScript extension files into your local Pi extensions directory:
   ```bash
   mkdir -p ~/.pi/agent/extensions/pi-openai-sync
   
   cp -r individual-packages/pi-openai-sync/* ~/.pi/agent/extensions/pi-openai-sync/
   ```
2. Restart Pi to load the new extensions.

---

## 🚀 Usage

### Interactive Slash Command

Use the `/openai-sync` command directly in the Pi terminal:

```bash
# Basic sync to default 'openai' provider
/openai-sync https://api.deepinfra.com/v1

# Sync using an API Bearer token
/openai-sync https://api.deepinfra.com/v1 your_api_key_here

# Sync to a custom provider target name (e.g. 'together')
/openai-sync https://api.together.xyz/v1 your_api_key_here together

# View command help and detailed documentation
/openai-sync --help
```

### Agent Tool

The extension registers the `openai_sync` tool with the Pi Coding Agent. The agent can use this tool to automatically fetch and configure new models for itself when you request to use an API it doesn't yet have configured:

**Tool Parameters:**
* `url` (Required): The base URL of the OpenAI-compatible endpoint.
* `apiKey` (Optional): The Bearer authentication token.
* `provider` (Optional): Target provider name in `models.json` (defaults to `"openai"`).

---

## 🛠️ Development & Building

This repository is organized as a structured mono-workspace with shared modules bundled into individual packages to facilitate lightweight distribution.

### Prerequisites

* Node.js >= 18
* `esbuild` (locally installed via devDependencies)

### Workflow Scripts

The root `package.json` contains scripts to format, test, and package the extension:

```bash
# 1. Install workspace dependencies
npm install

# 2. Type-check TypeScript sources
npm run typecheck

# 3. Run the automated unit test suite
npm run test

# 4. Bundle extensions and build target tarballs (.tgz)
npm run build
```

The build script (`./scripts/build.sh`) compiles and bundles the `extensions/openai-sync.ts` using `esbuild`. It inlines necessary shared dependencies from `shared/` while keeping Pi core packages (`@mariozechner/*`, `typebox`, and Node built-ins) as externals, outputting ready-to-install `.tgz` bundles to the `dist/` directory.

### Version Management

To atomically bump the version across all manifests, configuration files, and references, run the version bumping helper:

```bash
./scripts/bump-version.sh <new-version>

# Example:
./scripts/bump-version.sh 1.1.0
```

---

## 🤝 Acknowledgments

This project was inspired by [@vtstech/pi-ollama-sync](https://github.com/vtstech/pi-ollama-sync). Special thanks to the original author for the excellent implementation!

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
