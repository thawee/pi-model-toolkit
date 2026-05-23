// shared/ollama.ts
import * as fs from "node:fs";
import * as path from "node:path";
import os from "node:os";

// shared/debug.ts
var DEBUG_ENABLED = process?.env?.PI_EXTENSIONS_DEBUG === "1";
function debugLog(module, message, ...args) {
  if (!DEBUG_ENABLED) return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  console.debug(`[pi-ext:${module}] ${timestamp} ${message}`, ...args);
}

// shared/ollama.ts
var EXTENSION_VERSION = "1.1.0";
var MODELS_JSON_PATH = path.join(os.homedir(), ".pi", "agent", "models.json");
var _modelsJsonCache = null;
var _ollamaBaseUrlCache = null;
var CACHE_TTL_MS = 2e3;
function readModelsJson() {
  const now = Date.now();
  if (_modelsJsonCache && now - _modelsJsonCache.ts < CACHE_TTL_MS) return _modelsJsonCache.data;
  try {
    if (fs.existsSync(MODELS_JSON_PATH)) {
      const raw = fs.readFileSync(MODELS_JSON_PATH, "utf-8");
      const data = JSON.parse(raw);
      _modelsJsonCache = { data, ts: now };
      return data;
    }
  } catch (err) {
    debugLog("ollama", "failed to read/parse models.json", err);
  }
  const empty = { providers: {} };
  _modelsJsonCache = { data: empty, ts: now };
  return empty;
}
function writeModelsJson(data) {
  const dir = path.dirname(MODELS_JSON_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = MODELS_JSON_PATH + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  fs.renameSync(tmpPath, MODELS_JSON_PATH);
  _modelsJsonCache = null;
  _ollamaBaseUrlCache = null;
}
var _modelsJsonLock = null;
async function acquireModelsJsonLock() {
  while (_modelsJsonLock) {
    await _modelsJsonLock;
  }
  let releaseLock;
  _modelsJsonLock = new Promise((resolve) => {
    releaseLock = resolve;
  });
  return {
    release: () => {
      releaseLock();
      _modelsJsonLock = null;
    }
  };
}
async function readModifyWriteModelsJson(modifier) {
  const { release } = await acquireModelsJsonLock();
  try {
    const data = readModelsJson();
    const modified = modifier(data);
    if (modified === null) return false;
    writeModelsJson(modified);
    return true;
  } finally {
    release();
  }
}
var DEFAULT_RETRY_OPTIONS = {
  maxRetries: 2,
  baseDelayMs: 1e3,
  maxDelayMs: 1e4,
  retryOnTimeout: true,
  retryOnConnectionError: true
};
function backoffDelay(attempt, baseDelayMs, maxDelayMs) {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(delay + jitter));
}
var RETRYABLE_ERROR_PATTERNS = [
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "fetch failed",
  "network error",
  "socket hang up",
  "Empty response"
];
function isRetryableError(error, opts) {
  if (error instanceof Error) {
    if (error.name === "AbortError" && opts.retryOnTimeout) return true;
    const msg = error.message;
    if (opts.retryOnConnectionError && RETRYABLE_ERROR_PATTERNS.some((p) => msg.includes(p))) {
      return true;
    }
  }
  return false;
}
async function withRetry(fn, options) {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < opts.maxRetries && isRetryableError(error, opts)) {
        const delay = backoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
        debugLog("ollama", `Retry ${attempt + 1}/${opts.maxRetries} after ${delay}ms: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
function isReasoningModel(name) {
  const lower = name.toLowerCase();
  return lower.includes("deepseek-r1") || lower.includes("qwq") || /\bo1\b/.test(lower) || /\bo3\b/.test(lower) || lower.includes("qwen3") || lower.includes("reasoning") || lower.includes("thinker") || lower.includes("thinking");
}
function detectModelFamily(modelName) {
  const name = modelName.toLowerCase();
  const families = [
    ["qwen3.5", "qwen35"],
    ["qwen3", "qwen3"],
    ["qwen2.5", "qwen2"],
    ["qwen2", "qwen2"],
    ["qwen", "qwen2"],
    ["llama3.3", "llama"],
    ["llama3.2", "llama"],
    ["llama3.1", "llama"],
    ["llama3", "llama"],
    ["llama", "llama"],
    ["gemma3", "gemma3"],
    ["gemma2", "gemma2"],
    ["gemma", "gemma2"],
    ["granite", "granite"],
    ["dolphin", "dolphin"],
    ["glm-4", "glm"],
    ["glm", "glm"],
    ["deepseek-r1", "deepseek-r1"],
    ["deepseek", "deepseek"],
    ["mistral", "qwen2"],
    ["phi", "llama"],
    ["tinyllama", "llama"],
    ["codestral", "qwen2"]
  ];
  for (const [prefix, family] of families) {
    if (name.includes(prefix)) return family;
  }
  return "unknown";
}

// shared/provider-sync.ts
function mergeModels(newModels, oldModels) {
  const oldModelMap = new Map(oldModels.map((m) => [m.id, m]));
  return newModels.map((m) => {
    const old = oldModelMap.get(m.id);
    if (old) {
      const merged = { ...m };
      for (const [k, v] of Object.entries(old)) {
        if (!(k in m)) merged[k] = v;
      }
      return merged;
    }
    return m;
  });
}

// shared/format.ts
function section(title) {
  return `
\u2500\u2500 ${title} ${"\u2500".repeat(Math.max(1, 60 - title.length - 4))}`;
}
function ok(msg) {
  return `  \u2705 ${msg}`;
}
function warn(msg) {
  return `  \u26A0\uFE0F  ${msg}`;
}
function info(msg) {
  return `  \u2139\uFE0F  ${msg}`;
}

// extensions/openai-sync.ts
var BRANDING = [
  `  \u26A1 Pi Custom Models Suite v${EXTENSION_VERSION}`,
  `  OpenAI Compatibility Sync`,
  `  Written by thawee \u2014 https://github.com/thawee`
].join("\n");
function normalizeUrl(inputUrl) {
  let clean = inputUrl.trim().replace(/\/+$/, "");
  let queryUrl;
  let baseUrl;
  if (clean.endsWith("/models")) {
    queryUrl = clean;
    baseUrl = clean.slice(0, -7).replace(/\/+$/, "");
  } else {
    baseUrl = clean;
    queryUrl = `${clean}/models`;
  }
  return { queryUrl, baseUrl };
}
function deriveProviderNameFromUrl(inputUrl) {
  let clean = inputUrl.trim();
  if (!/^https?:\/\//i.test(clean)) {
    clean = "http://" + clean;
  }
  try {
    const parsed = new URL(clean);
    let name = parsed.hostname;
    if (parsed.port) {
      name += `-${parsed.port}`;
    }
    name = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return name || "openai-custom";
  } catch {
    return "openai-custom";
  }
}
async function fetchOpenAIModels(queryUrl, apiKey) {
  return withRetry(async () => {
    const headers = {
      "Accept": "application/json"
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const res = await fetch(queryUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      throw new Error(`API returned ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid response format: 'data' array not found");
    }
    return data.data;
  });
}
function getProviderConfig(existing, providerName, baseUrl, apiKey) {
  const prov = existing.providers[providerName];
  return {
    baseUrl: prov?.baseUrl ?? baseUrl,
    api: prov?.api ?? "openai-completions",
    apiKey: apiKey ?? prov?.apiKey ?? "openai",
    compat: prov?.compat ?? {
      supportsDeveloperRole: true,
      supportsReasoningEffort: false
    }
  };
}
async function performSync(providerName, inputUrl, apiKey) {
  let finalProviderName = providerName;
  let finalBaseUrl = "";
  let queryUrl = "";
  if (inputUrl) {
    const norm = normalizeUrl(inputUrl);
    finalBaseUrl = norm.baseUrl;
    queryUrl = norm.queryUrl;
    if (!finalProviderName) {
      try {
        const existing = readModelsJson();
        const matched = Object.entries(existing.providers).find(([_, prov]) => {
          if (!prov.baseUrl) return false;
          return normalizeUrl(prov.baseUrl).baseUrl === finalBaseUrl;
        });
        if (matched) {
          finalProviderName = matched[0];
        }
      } catch {
      }
    }
  }
  if (!finalProviderName) {
    finalProviderName = inputUrl ? deriveProviderNameFromUrl(inputUrl) : "openai";
  }
  if (!inputUrl) {
    const preview = readModelsJson();
    const config = preview.providers[finalProviderName];
    if (!config?.baseUrl) {
      return {
        providerName: finalProviderName,
        baseUrl: "",
        newModels: [],
        added: [],
        removed: [],
        error: `No existing configuration found for provider "${finalProviderName}". Please specify a URL.`
      };
    }
    const norm = normalizeUrl(config.baseUrl);
    finalBaseUrl = norm.baseUrl;
    queryUrl = norm.queryUrl;
    if (!apiKey) {
      apiKey = config.apiKey;
    }
  }
  try {
    const rawModels = await fetchOpenAIModels(queryUrl, apiKey);
    if (rawModels.length === 0) {
      return {
        providerName: finalProviderName,
        baseUrl: finalBaseUrl,
        newModels: [],
        added: [],
        removed: [],
        error: "No models found in the API response"
      };
    }
    const newModels = rawModels.map((m) => ({
      id: m.id,
      reasoning: isReasoningModel(m.id),
      modelFamily: detectModelFamily(m.id)
    }));
    let added = [];
    let removed = [];
    await readModifyWriteModelsJson((existing) => {
      const config = getProviderConfig(existing, finalProviderName, finalBaseUrl, apiKey);
      const oldIds = new Set(
        existing.providers[finalProviderName]?.models?.map((m) => m.id) ?? []
      );
      added = newModels.filter((m) => !oldIds.has(m.id));
      removed = [...oldIds].filter((id) => !newModels.some((m) => m.id === id));
      const mergedModels = mergeModels(
        newModels,
        existing.providers[finalProviderName]?.models ?? []
      );
      existing.providers[finalProviderName] = {
        ...config,
        models: mergedModels
      };
      return existing;
    });
    return {
      providerName: finalProviderName,
      baseUrl: finalBaseUrl,
      newModels,
      added,
      removed
    };
  } catch (err) {
    return {
      providerName: finalProviderName,
      baseUrl: finalBaseUrl,
      newModels: [],
      added: [],
      removed: [],
      error: err.message
    };
  }
}
function openai_sync_default(pi) {
  pi.registerCommand("openai-sync", {
    description: "Sync available models from an OpenAI-compatible API (e.g. Ollama, llama.cpp, Together AI) into your Pi configuration. Use: /openai-sync <url> [apiKey]",
    detailedHelp: "\n\n\u{1F504} OpenAI Compatibility Sync (Pi Custom Models Suite)\n\nSynchronizes available models from any OpenAI-compatible API\n(such as Ollama, llama.cpp, Together AI, DeepInfra, etc.)\ninto Pi's models.json configuration file.\n\n\u{1F4CB} Usage:\n  /openai-sync <url> [apiKey] - Sync with URL (provider derived automatically from host/port)\n  /openai-sync --help         - Show this help\n\n\u{1F527} Features:\n\u2022 Reasoning model auto-detection\n\u2022 Model family auto-detection\n\u2022 Atomic configuration updates\n\u2022 Compatible with local instances (Ollama, llama.cpp)\n\u2022 Compatible with cloud providers (Together AI, DeepInfra)\n",
    async handler(args, ctx) {
      if (args.trim() === "--help") {
        ctx.ui.notify(
          "\u{1F504} OpenAI Compatibility Sync (Pi Custom Models Suite)\n\n\u{1F4CB} Usage:\n  /openai-sync <url> [apiKey] - Sync with URL (provider derived automatically from host/port)\n  /openai-sync --help         - Show this help\n\n\u{1F527} Compatibility & Features:\n\u2022 Works with Ollama, llama.cpp, and other local/remote OpenAI-compatible APIs\n\u2022 Reasoning model auto-detection\n\u2022 Model family auto-detection\n\u2022 Atomic configuration updates\n",
          "info"
        );
        return;
      }
      const parts = args.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) {
        ctx.ui.notify("Usage: /openai-sync <url> [apiKey]", "info");
        return;
      }
      const url = parts[0];
      const apiKey = parts[1] !== "undefined" ? parts[1] : void 0;
      const providerName = deriveProviderNameFromUrl(url);
      ctx.ui.setStatus("openai-sync", "Fetching models...");
      try {
        const result = await performSync(providerName, url, apiKey);
        if (result.error) {
          ctx.ui.notify(result.error, "error");
          ctx.ui.setStatus("openai-sync", void 0);
          return;
        }
        const { baseUrl, newModels, added, removed, providerName: finalProvider } = result;
        const lines = [""];
        lines.push(`  Provider: ${finalProvider}`);
        lines.push(`  Base URL: ${baseUrl}`);
        lines.push(`  Synced ${newModels.length} models`);
        lines.push(section("Synced Models"));
        for (const m of newModels) {
          lines.push(ok(m.id));
        }
        if (added.length > 0 || removed.length > 0) {
          lines.push(section("Changes"));
          if (added.length > 0) {
            lines.push(ok(`Added ${added.length}: ${added.map((m) => m.id).join(", ")}`));
          }
          if (removed.length > 0) {
            lines.push(warn(`Removed ${removed.length}: ${removed.join(", ")}`));
          }
        } else {
          lines.push(info("No changes \u2014 already in sync"));
        }
        lines.push("");
        lines.push(`  Written to ${MODELS_JSON_PATH}`);
        lines.push(`  Run /reload to pick up changes`);
        lines.push(BRANDING);
        const report = lines.join("\n");
        const summary = [`Synced ${newModels.length} models to ${finalProvider}`];
        if (added.length > 0) summary.push(`+${added.map((m) => m.id).join(", ")}`);
        if (removed.length > 0) summary.push(`-${removed.join(", ")}`);
        ctx.ui.notify(summary.join(" \xB7 "), "success");
        pi.sendMessage({
          customType: "openai-sync-report",
          content: report,
          display: { type: "content", content: report },
          details: { timestamp: (/* @__PURE__ */ new Date()).toISOString(), added: added.length, removed: removed.length }
        });
      } catch (err) {
        ctx.ui.notify(`Failed: ${err.message}`, "error");
      }
      ctx.ui.setStatus("openai-sync", void 0);
    }
  });
  pi.registerTool({
    name: "openai_sync",
    label: "OpenAI Compatibility Sync",
    description: "Synchronize available models from an OpenAI-compatible server into Pi's configuration.\n\n" + BRANDING,
    parameters: {
      type: "object",
      properties: {
        provider: {
          type: "string",
          description: "Optional target provider key in models.json (e.g., deepinfra, together). Derived from url if omitted."
        },
        url: {
          type: "string",
          description: "OpenAI-compatible base URL (e.g. https://api.deepinfra.com/v1)"
        },
        apiKey: {
          type: "string",
          description: "Optional API Bearer token."
        }
      },
      required: ["url"]
    },
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const provider = params?.provider;
      const url = params?.url;
      const apiKey = params?.apiKey;
      const result = await performSync(provider, url, apiKey);
      if (result.error) {
        return {
          content: [{ type: "text", text: `Error: ${result.error}` }],
          details: {}
        };
      }
      const { providerName, baseUrl, newModels } = result;
      const modelDetails = newModels.map((m) => `  \u2022 ${m.id} (reasoning: ${m.reasoning}, family: ${m.modelFamily})`).join("\n");
      return {
        content: [
          {
            type: "text",
            text: `${BRANDING}

Synced ${newModels.length} models from ${baseUrl} to provider "${providerName}" in ${MODELS_JSON_PATH}.

${modelDetails}`
          }
        ],
        details: { models: newModels, provider: providerName }
      };
    }
  });
}
export {
  openai_sync_default as default,
  deriveProviderNameFromUrl,
  fetchOpenAIModels,
  normalizeUrl
};
