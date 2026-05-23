// extensions/llama-model.ts
import { readFileSync } from "node:fs";
import { join as join2 } from "node:path";

// shared/ollama.ts
import * as path from "node:path";
import os from "node:os";

// shared/debug.ts
var DEBUG_ENABLED = process?.env?.PI_EXTENSIONS_DEBUG === "1";

// shared/ollama.ts
var EXTENSION_VERSION = "1.1.0";
var MODELS_JSON_PATH = path.join(os.homedir(), ".pi", "agent", "models.json");

// extensions/llama-model.ts
var BRANDING = [
  `  \u26A1 Pi Custom Models Suite v${EXTENSION_VERSION}`,
  `  llama.cpp Router Management`,
  `  Written by thawee \u2014 https://github.com/thawee`
].join("\n");
function resolveUrl(cwd) {
  try {
    const raw = readFileSync(join2(cwd, ".pi", "llama-server.json"), "utf-8");
    const cfg = JSON.parse(raw);
    if (cfg.url) {
      return cfg.url.trim().replace(/\/+$/, "");
    }
  } catch {
  }
  const envUrl = process.env.LLAMA_SERVER_URL;
  if (envUrl) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "http://127.0.0.1:8080";
}
async function rpc(base, method, body) {
  const url = `${base}${method}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : void 0,
    body: body ? JSON.stringify(body) : void 0,
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}
async function listModels(base) {
  const data = await rpc(base, "/models");
  return (data.data ?? []).filter(
    (m) => m.id && m.id !== "llama-server" && m.id !== "main"
  );
}
async function llama_model_default(pi) {
  const cwd = process.cwd();
  const url = resolveUrl(cwd);
  let serverModels;
  try {
    serverModels = await listModels(url);
  } catch (e) {
    pi.registerCommand("llama-model", {
      description: "Manage, load, and switch models on a live llama.cpp server running in router mode (offline)",
      handler: async (_args, ctx) => {
        ctx.ui.notify(
          `llama-server unreachable at ${resolveUrl(ctx.cwd)}`,
          "error"
        );
      }
    });
    return;
  }
  const modelDefs = serverModels.map((m) => ({
    id: String(m.id),
    name: String(m.id),
    reasoning: false,
    input: ["text"],
    contextWindow: 128e3,
    maxTokens: 16384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  }));
  if (modelDefs.length > 0) {
    pi.registerProvider("llama-server", {
      baseUrl: `${url}/v1`,
      api: "openai-completions",
      apiKey: "not-needed",
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false
      },
      models: modelDefs
    });
  }
  pi.on("model_select", async (event, ctx) => {
    if (event.model.provider !== "llama-server") return;
    try {
      await rpc(resolveUrl(ctx.cwd), "/models/load", {
        model: event.model.id
      });
    } catch {
    }
  });
  pi.registerCommand("llama-model", {
    description: "Manage, load, and switch models on a live llama.cpp server running in router mode",
    handler: async (_args, ctx) => {
      const base = resolveUrl(ctx.cwd);
      let models;
      try {
        models = await listModels(base);
      } catch (e) {
        ctx.ui.notify(`llama-server unreachable: ${e.message}`, "error");
        return;
      }
      if (models.length === 0) {
        ctx.ui.notify("No models loaded on the llama-server", "info");
        return;
      }
      const modelDefs2 = models.map((m) => ({
        id: String(m.id),
        name: String(m.id),
        reasoning: false,
        input: ["text"],
        contextWindow: 128e3,
        maxTokens: 16384,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
      }));
      pi.registerProvider("llama-server", {
        baseUrl: `${base}/v1`,
        api: "openai-completions",
        apiKey: "not-needed",
        compat: {
          supportsDeveloperRole: false,
          supportsReasoningEffort: false
        },
        models: modelDefs2
      });
      const labels = models.map((m) => {
        const c = m.status.value === "loaded" ? "\u{1F7E2}" : m.status.value === "loading" ? "\u{1F7E1}" : m.status.value === "failed" ? "\u{1F534}" : "\u26AA";
        return `${c} ${m.id}`;
      });
      const choice = await ctx.ui.select("llama-server models:", labels);
      if (choice == null) return;
      const idx = labels.indexOf(choice);
      const model = models[idx];
      const actions = model.status.value === "loaded" ? ["Switch", "Unload", "Cancel"] : ["Load & switch", "Cancel"];
      const action = await ctx.ui.select(`${model.id}`, actions);
      if (!action || action === "Cancel") return;
      ctx.ui.setStatus("llama-model", `${action === "Unload" ? "Unloading" : "Loading"} ${model.id}...`);
      try {
        if (action === "Unload") {
          await rpc(base, "/models/unload", { model: model.id });
          ctx.ui.notify(`Unloaded ${model.id}`, "success");
        } else {
          if (model.status.value !== "loaded") {
            await rpc(base, "/models/load", { model: model.id });
          }
          const registryModel = ctx.modelRegistry.find("llama-server", model.id);
          if (registryModel) {
            const ok = await pi.setModel(registryModel);
            if (ok) {
              ctx.ui.notify(`Switched active model to ${model.id}`, "success");
            } else {
              ctx.ui.notify(`Failed to switch active model to ${model.id}`, "error");
            }
          } else {
            ctx.ui.notify(`Model ${model.id} ready, but registry configuration not found.`, "error");
          }
        }
      } catch (e) {
        ctx.ui.notify(`Action failed: ${e.message}`, "error");
      } finally {
        ctx.ui.setStatus("llama-model", void 0);
      }
    }
  });
}
export {
  llama_model_default as default,
  listModels,
  resolveUrl
};
