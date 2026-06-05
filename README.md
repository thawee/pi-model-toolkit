# ⚡ openai-toolkit

Manage and switch models dynamically on OpenAI-compatible servers seamlessly.

`openai-toolkit` is an advanced model orchestration extension for Pi Agent. It replaces manual model configuration with automated discovery, configuration sync, and live router management directly inside the agent interface.

---

## 🚀 Key Features

* **🔄 Unified Startup Sync:** Probes local providers (llama.cpp, vLLM, Ollama, etc.) on startup. If online, it merges discovered models into your `models.json` (preserving user overrides) and registers them with Pi.
* **🛡️ Safe Offline Startup:** If a configured local server is offline or unreachable on startup, the toolkit automatically empties the models list in `models.json` for that provider, preventing selection of dead models.
* **🎛️ Live VRAM / Router TUI:** Provides a fully interactive TUI via `/llama-swap` to load/unload models dynamically into/from VRAM and hot-switch the active model on a running llama.cpp server without restarting.
* **🔌 Session indicators:** Automatically registers stub commands for offline providers to alert you if a server is unreachable.

---

## 📦 Project Structure

* [package.json](file:///Users/thawee.p/Workspaces/github/pi-model-toolkit/package.json) - Dependencies & package metadata
* [extensions/index.ts](file:///Users/thawee.p/Workspaces/github/pi-model-toolkit/extensions/index.ts) - Extension entry point
* [extensions/openai-sync.ts](file:///Users/thawee.p/Workspaces/github/pi-model-toolkit/extensions/openai-sync.ts) - OpenAI-compatible server management & synchronization logic
* [shared/ollama.ts](file:///Users/thawee.p/Workspaces/github/pi-model-toolkit/shared/ollama.ts) - Shared configuration & metadata parsing
* [shared/provider-sync.ts](file:///Users/thawee.p/Workspaces/github/pi-model-toolkit/shared/provider-sync.ts) - Model merging & configuration diffing
* [scripts/](file:///Users/thawee.p/Workspaces/github/pi-model-toolkit/scripts) - Management and compilation shell scripts

---

## ⚙️ Configuration (`models.json`)

On startup, `openai-toolkit` iterates through all local providers defined in `~/.pi/agent/models.json`.

### Local Provider Detection
A provider is considered local if:
1. The provider name is `ollama`.
2. The `baseUrl` contains `localhost`, `127.0.0.1`, or `0.0.0.0`.

### Example Configuration
Add the providers you want to manage to your `~/.pi/agent/models.json` file:

```json
{
  "providers": {
    "llama-server": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "models": []
    },
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "models": []
    }
  }
}
```

---

## 🛠️ Installation & Build Scripts

You can install `openai-toolkit` either from GitHub or compile/install it locally.

### 1. Remote Installation (From GitHub)

Use the remote installer script to download compiled bundles directly:

```bash
# Install from the main branch
./scripts/install-remote.sh

# Install from a specific branch or version tag (e.g. v1.2.0)
./scripts/install-remote.sh v1.2.0
```

*Alternatively, install via the Pi Agent CLI:*
```bash
pi install git:github.com/thawee/pi-openai-toolkit
```

### 2. Local Build & Installation

If you are developing or customizing the toolkit:

```bash
# 1. Clone the repository
git clone https://github.com/thawee/pi-openai-toolkit.git
cd pi-openai-toolkit

# 2. Install dependencies & compile TS into bundled JS
npm install
npm run build        # Executes scripts/build.sh

# 3. Install the compiled extension locally into ~/.pi/agent/extensions
npm run install:local # Executes scripts/install.sh
```

Restart Pi to load the newly installed extension.

---

## 📖 User Guide

### 🎛️ Command Reference

Run slash commands directly inside your terminal session to manage models:

* **`/llama-swap` (or `/llama-swap:<provider-name>`)**
  Opens an interactive TUI to manage your running llama.cpp router models:
  * **🟢 Green Indicator:** Model is currently loaded in VRAM and active.
  * **🟡 Yellow Indicator:** Model is currently loading/initializing.
  * **🔴 Red Indicator:** Model failed to load.
  * **⚪ White/Grey Indicator:** Model is not loaded.
  
  *Actions:*
  * **Switch:** Switched the active model in the session.
  * **Load & switch:** Instructs the router to load the model into VRAM and makes it active.
  * **Unload:** Unloads the model from VRAM to free up GPU resources.
  * **Cancel:** Closes the select dialog.

* **`/llama-swap:<offline-provider>`**
  If a provider is unreachable on startup, a fallback stub command is registered. Running it displays an error notification reminding you that the server is currently down.

---

## 🧪 Development

* **Typechecking:** Run `npm run typecheck` to check TypeScript compilation.
* **Testing:** Run `npm test` to execute the full test suite.
* **Version Bumper:** Run `./scripts/bump-version.sh <version>` to safely bump the package version across `VERSION`, `shared/ollama.ts`, `package.json`, and all docs.

---

## 🙏 Acknowledgments

Thanks to [pi-ollama-sync](https://github.com/vtstech/pi-ollama-sync) for inspiring early versions of this project.

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
