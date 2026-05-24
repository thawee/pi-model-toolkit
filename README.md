# ⚡ pi-model-toolkit
Integrate any local or remote model seamlessly.

`pi-model-toolkit` is an advanced model orchestration suite for Pi Agent that brings autonomous synchronization and robust router management to your AI environment.

Instead of manually editing configuration files and hunting down context window parameters, this suite provides two distinct, highly optimized tools designed for frictionless model management:

### ⚡ `/openai-sync` (API Synchronization)
- **One-click synchronization:** Dynamically fetch and inject models from any OpenAI-compatible API (Ollama, Together AI, DeepInfra, OpenRouter).
- 🧠 **Reasoning model auto-detection:** Automatically identifies and configures `reasoning: true` for thinking models (e.g., `deepseek-r1`).
- 🏷️ **Smart model family classification:** Classifies lineages (`llama`, `qwen`) to set the correct tokenizers.
- 🔒 **Atomic updates:** Transaction-safe file writes to safely update Pi's `models.json` without corruption.

### 🔄 `/llama-model` (Router Management)
- **Live `llama.cpp` hot-switching:** Interact via a TUI to browse, load, and unload models dynamically on a running `llama.cpp` server.
- 🛡️ **Safe offline startup:** Gracefully handles server boots and falls back smoothly if the instance is down.

### 🛠️ The Workflows

#### 1. The Sync Workflow (`/openai-sync`)
Stop copying and pasting JSON. Bring your external endpoints right into your active workspace.
- 📝 **[P]robe:** Type `/openai-sync <url>` to query any `/v1/models` endpoint.
- ✋ **[A]nalyze:** The extension auto-detects reasoning flags (`deepseek-r1`) and families (`qwen`, `llama`).
- ⚡ **[I]ntegrate:** The new models are transactionally injected into Pi's `models.json`.

#### 2. The Router Workflow (`/llama-model`)
Stop restarting your local server. Manage local models dynamically.
- 🖥️ **Browse:** Type `/llama-model` to open an interactive TUI.
- 🔄 **Hot-Swap:** Select a loaded model or load a new one directly into VRAM.
- ✅ **Deploy:** Instantly set it as Pi's active model without breaking flow.

---

## 🚀 Key Benefits

### `/openai-sync`
1. **⚡ One-Click Synchronization:** Point to any OpenAI-compatible provider (Ollama, DeepInfra, OpenRouter, etc.) and instantly sync all available models down to your local registry.
2. **🧠 Reasoning Auto-Detection:** Automatically identifies "thinking" models (like `deepseek-r1`, `o1-mini`) and injects `"reasoning": true`. This ensures Pi communicates using the specialized, strict prompt structures required by these models.
3. **🏷️ Model Family Classification:** Safely classifies model lineages (e.g., `llama`, `qwen`, `deepseek`) to properly configure internal tokenizer mappings and templating behavior.

### `/llama-model`
4. **🔄 Active Hot-Switching:** Interact via a beautiful TUI to browse, load, and unload models dynamically on a live `llama.cpp` instance running in router mode — without restarting your server.
5. **🛡️ Safe Offline Startup:** Gracefully handles offline `llama.cpp` instances on startup, so your agent boots safely even if your local inference server is down.

### Core Architecture
6. **🔒 Atomic Updates:** File writes to Pi's core `models.json` use robust read-modify-write transactional locks with automatic retries to completely prevent configuration corruption.

---

## 🧠 Core Philosophy

This suite shifts the burden of maintaining model compatibility away from tedious manual file edits into seamless, programmatic orchestration. It solves the biggest headaches when juggling multiple LLM providers:

* **The Fragmentation Problem:** Manually copying model tags from Ollama or DeepInfra into static JSON is slow and error-prone. The `/openai-sync` command treats external APIs as the ultimate source of truth, automating discovery and integration.
* **Structural Enforcement for Reasoning:** Advanced models like `deepseek-r1` require drastically different system prompt boundaries. By auto-detecting these features natively, the sync tool guarantees your prompts will not break or cause API rejections.
* **Live Developer Experience:** Waiting for large parameter models to load into VRAM disrupts flow. The `/llama-model` integration offers a fast, zero-downtime control panel directly inside the agent interface for frictionless local development.

---

## 📦 Getting Started

### 1. Project Structure

```
pi-model-toolkit/
├── README.md           # Documentation
├── package.json        # Dependencies & package metadata
├── scripts/            # Compilation and build scripts
└── extensions/
    ├── openai-sync.ts  # API discovery & synchronization
    └── llama-model.ts  # llama.cpp router management
```

### 2. Installation & Configuration

You can install the suite directly from GitHub using the Pi Agent CLI:

```bash
pi install git:github.com/thawee/pi-model-toolkit
```

Pi will clone the repository, automatically discover the bundled `.js` extensions, and register them globally. Reload Pi to activate.

> 💡 **Note for /llama-model:** If you are running `llama.cpp` on a non-standard host/port, you can create a `.pi/llama-server.json` in your workspace with `{"url": "http://your-host:port"}` or set the `LLAMA_SERVER_URL` environment variable.

---

## 📖 User Guide

### 🎛️ Available Commands

Run these slash commands directly inside your terminal session to manage your models:

* **/openai-sync `<url>` `[apiKey]`:** Fetches and synchronizes models from an OpenAI-compatible API. The provider name is smartly derived from the URL host (e.g. `api-deepinfra-com`).
* **/llama-model:** Opens an interactive TUI to browse, load, unload, and set the active model on your running `llama.cpp` server.

### 🔄 Example: Adding DeepInfra (`/openai-sync`)

1. **Trigger Sync:** 
   ```bash
   /openai-sync https://api.deepinfra.com/v1 your_api_key
   ```
2. **Review Output:** The agent reports exactly which new models were added, highlighting automatically detected reasoning capabilities.

---

## ⚙️ Technical Architecture (Under the Hood)

### 🤖 Tool Registration (Autonomous Agents)

The extension exposes the `openai_sync` tool directly to the LLM. If the agent realizes a requested model is missing from its context, it can autonomously query an external provider and inject it into the registry without human intervention.

### 🛡️ Atomic I/O Safety

All writes to the Pi core `models.json` are gated behind a transactional lock file mechanism (`models.json.lock`). This prevents race conditions if multiple extensions or agent threads attempt to update the configuration file simultaneously.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
