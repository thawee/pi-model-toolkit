# ⚡ llama-toolkit
Manage models on llama.cpp router mode seamlessly.

`llama-toolkit` is an advanced model orchestration extension for Pi Agent that brings robust router management to your AI environment.

Instead of restarting your server or manually loading models, this extension provides a highly optimized tool designed for frictionless model management directly within your agent interface.

### 🔄 `/llama-server` (Router Management)
- **Live `llama.cpp` hot-switching:** Interact via a TUI to browse, load, and unload models dynamically on a running `llama.cpp` server.
- 🛡️ **Safe offline startup:** Gracefully handles server boots and falls back smoothly if the instance is down.

---

## 🚀 Key Benefits

1. **🔄 Active Hot-Switching:** Interact via a beautiful TUI to browse, load, and unload models dynamically on a live `llama.cpp` instance running in router mode — without restarting your server.
2. **🛡️ Safe Offline Startup:** Gracefully handles offline `llama.cpp` instances on startup, so your agent boots safely even if your local inference server is down.

---

## 🧠 Core Philosophy

This extension shifts the burden of maintaining model compatibility away from tedious manual configuration into seamless, programmatic orchestration. It solves one of the biggest headaches in local LLM development:

* **Live Developer Experience:** Waiting for large parameter models to load into VRAM disrupts flow. The `/llama-server` integration offers a fast, zero-downtime control panel directly inside the agent interface for frictionless local development.

---

## 📦 Getting Started

### 1. Project Structure

```text
llama-toolkit/
├── README.md           # Documentation
├── package.json        # Dependencies & package metadata
├── scripts/            # Compilation and build scripts
└── extensions/
    ├── index.ts        # Entry point
    └── llama-server.ts # llama.cpp router management
```

### 2. Installation & Configuration

You can install the suite directly from GitHub using the Pi Agent CLI:

```bash
pi install git:github.com/thawee/llama-toolkit
```

Pi will clone the repository, automatically discover the bundled `.js` extensions, and register them globally. Reload Pi to activate.

> 💡 **Note for /llama-server:** If you are running `llama.cpp` on a non-standard host/port, you can create a `.pi/llama-server.json` in your workspace with `{"url": "http://your-host:port"}` or set the `LLAMA_SERVER_URL` environment variable. Defaults to `http://127.0.0.1:8080`.

---

## 📖 User Guide

### 🎛️ Available Commands

Run this slash command directly inside your terminal session to manage your models:

* **/llama-server:** Opens an interactive TUI to browse, load, unload, and set the active model on your running `llama.cpp` server.

---

## ⚙️ Technical Architecture (Under the Hood)

### 🤖 Tool Registration (Autonomous Agents)

The extension registers the `llama-server` provider dynamically. Models loaded on the server are made available to Pi's model registry. When a model is selected, the extension automatically instructs the `llama-server` to load it into VRAM if it isn't already.

---

## 🙏 Acknowledgments

Thanks to [@vtstech/pi-ollama-sync](https://github.com/vtstech/pi-ollama-sync) for the inspiration for early versions of this project.

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
