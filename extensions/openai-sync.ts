// ~/.pi/agent/extensions/openai-sync.ts
// OpenAI-Compatible Models Sync
//
// Discovers and syncs models from local OpenAI-compatible providers
// (llama.cpp, vLLM, Ollama, etc.) in a single startup pass.
// For each local provider in models.json:
//   1. Probes the OpenAI-compatible /v1/models (or Ollama /api/tags)
//   2. If reachable → merges models, registers with Pi, adds interactive commands
//   3. If unreachable → empties the models list so the user can't select dead models

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  readModifyWriteModelsJson,
  fetchOllamaModels,
  fetchOpenAIModels,
  isReasoningModel,
  detectModelFamily,
  isLocalProvider,
  getOllamaBaseUrl,
  type PiModelsJson,
  type PiModelEntry,
  type PiProviderConfig,
} from "../shared/ollama";
import { mergeModels } from "../shared/provider-sync";

// ============================================================================
// Types (re-exported for tests and other consumers)
// ============================================================================

export interface ServerModel {
  id: string;
  status: { value: string };
}

// ============================================================================
// RPC helper (for llama-server router operations)
// ============================================================================

async function rpc(base: string, method: string, body?: Record<string, unknown>) {
  const url = `${base}${method}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ============================================================================
// Model listing (llama-server router)
// ============================================================================

/**
 * Retrieve models from a llama-server router's /models endpoint.
 * Filters out internal pseudo-models.
 */
export async function listModels(base: string): Promise<ServerModel[]> {
  const data = (await rpc(base, "/models")) as {
    data?: ServerModel[];
  };
  return (data.data ?? []).filter(
    (m) => m.id && m.id !== "llama-server" && m.id !== "main" && m.id !== "default"
  );
}

/**
 * Check if a base URL belongs to a llama-server router.
 */
async function isLlamaServerRouter(base: string): Promise<boolean> {
  try {
    const data = await rpc(base, "/models");
    return Array.isArray(data.data);
  } catch {
    return false;
  }
}

// ============================================================================
// Entry Point
// ============================================================================

/**
 * OpenAI-Compatible Models Sync — unified local provider discovery and management.
 *
 * Single pass over all providers in models.json:
 *   - Discovers models via OpenAI-compatible or Ollama API
 *   - Empties models list for unreachable providers
 *   - Registers llama-server interactive commands where applicable
 */
export default async function (pi: ExtensionAPI) {
  await readModifyWriteModelsJson(async (data: PiModelsJson) => {
    const providers = data.providers || {};
    let changed = false;

    for (const [name, config] of Object.entries(providers)) {
      const baseUrl = config.baseUrl || "";
      const apiMode = config.api || "";

      // Skip non-local providers
      if (!isLocalProvider(baseUrl, name)) continue;

      // Normalize base URL for router probing (strip /v1 suffix)
      const routerBase = baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");

      try {
        let freshModels: PiModelEntry[] = [];

        if (name === "ollama" || apiMode === "ollama") {
          // Ollama Sync — use native API for richer metadata
          const url = baseUrl ? baseUrl.replace(/\/v1\/?$/, "") : getOllamaBaseUrl();
          const models = await fetchOllamaModels(url);
          freshModels = models.map((m) => ({
            id: m.name,
            name: m.name,
            reasoning: isReasoningModel(m.name),
            modelFamily: detectModelFamily(m.name),
            parameterSize: m.details.parameter_size,
            quantizationLevel: m.details.quantization_level,
          }));
        } else {
          // OpenAI-compatible Sync (llama.cpp, vLLM, etc.)
          const modelIds = await fetchOpenAIModels(baseUrl, config.apiKey);
          freshModels = modelIds.map((id) => ({
            id: id,
            name: id,
            reasoning: isReasoningModel(id),
            modelFamily: detectModelFamily(id),
          }));
        }

        // Merge with existing config (preserves user overrides)
        const merged = mergeModels(freshModels, config.models || []);

        // Check for llama-server router capabilities and register interactive commands
        if (routerBase && await isLlamaServerRouter(routerBase)) {
          registerLlamaServerProvider(pi, name, routerBase, config, merged);
        } else {
          // Non-router local provider — register with Pi for the session
          registerPlainProvider(pi, name, baseUrl, config, merged);
        }

        // Persist if models changed
        if (JSON.stringify(merged) !== JSON.stringify(config.models)) {
          config.models = merged;
          changed = true;
        }
      } catch {
        // Provider is unreachable — empty the models list so user can't
        // accidentally select a model that isn't available right now.
        if (config.models && config.models.length > 0) {
          config.models = [];
          changed = true;
        }

        // Register a stub command that shows an offline notification
        pi.registerCommand(`llama-swap:${name}`, {
          description: `Manage models on ${name} (offline)`,
          handler: async (_args: string, ctx: any) => {
            ctx.ui.notify(`${name} unreachable at ${baseUrl}`, "error");
          },
        });
      }
    }

    return changed ? data : null;
  });
}

// ============================================================================
// Provider Registration Helpers
// ============================================================================

/**
 * Register a plain (non-router) local provider with Pi.
 */
function registerPlainProvider(
  pi: ExtensionAPI,
  name: string,
  baseUrl: string,
  config: PiProviderConfig,
  models: PiModelEntry[],
) {
  pi.registerProvider(name, {
    baseUrl: baseUrl || (name === "ollama" ? `${getOllamaBaseUrl()}/v1` : ""),
    api: config.api || (name === "ollama" ? "openai-completions" : ""),
    apiKey: config.apiKey,
    compat: config.compat,
    models,
  });
}

/**
 * Register a llama-server router provider with Pi + interactive commands.
 */
function registerLlamaServerProvider(
  pi: ExtensionAPI,
  name: string,
  routerBase: string,
  config: PiProviderConfig,
  models: PiModelEntry[],
) {
  const registerWithPi = (modelDefs: PiModelEntry[]) => {
    pi.registerProvider(name, {
      baseUrl: `${routerBase}/v1`,
      api: "openai-completions",
      apiKey: config.apiKey,
      compat: config.compat,
      models: modelDefs.map((m) => ({
        ...m,
        input: ["text"] as const,
        contextWindow: 128000,
        maxTokens: 16384,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      })),
    });
  };

  // Initial registration
  registerWithPi(models);

  // Tell server to load model on selection
  pi.on("model_select", async (event: any, _ctx: any) => {
    if (event.model.provider !== name) return;
    try {
      await rpc(routerBase, "/models/load", { model: event.model.id });
    } catch {
      // server may have autoload
    }
  });

  // Interactive /llama-swap:<name> command
  const cmdName = `llama-swap:${name}`;
  const commands = [cmdName];
  if (name === "llama-server" || name === "local-lama" || name === "llama-swap") {
    commands.push("llama-swap");
  }

  for (const cmd of commands) {
    pi.registerCommand(cmd, {
      description: `Manage, load, and switch models on ${name}`,
      handler: async (_args: string, ctx: any) => {
        let serverModels: ServerModel[];
        try {
          serverModels = await listModels(routerBase);
        } catch (e: any) {
          ctx.ui.notify(`${name} unreachable: ${e.message}`, "error");
          return;
        }

        if (serverModels.length === 0) {
          ctx.ui.notify(`No models loaded on ${name}`, "info");
          return;
        }

        // Dynamically refresh provider models from server state
        const refreshed: PiModelEntry[] = serverModels.map((m) => ({
          id: String(m.id),
          name: String(m.id),
          reasoning: isReasoningModel(String(m.id)),
          modelFamily: detectModelFamily(String(m.id)),
        }));
        registerWithPi(refreshed);

        const labels = serverModels.map((m) => {
          const c =
            m.status.value === "loaded" ? "🟢"
            : m.status.value === "loading" ? "🟡"
            : m.status.value === "failed" ? "🔴"
            : "⚪";
          return `${c} ${m.id}`;
        });

        const choice = await ctx.ui.select(`${name} models:`, labels);
        if (choice == null) return;

        const idx = labels.indexOf(choice);
        const model = serverModels[idx];

        const actions =
          model.status.value === "loaded"
            ? ["Switch", "Unload", "Cancel"]
            : ["Load & switch", "Cancel"];

        const action = await ctx.ui.select(`${model.id}`, actions);
        if (!action || action === "Cancel") return;

        ctx.ui.setStatus(name, `${action === "Unload" ? "Unloading" : "Loading"} ${model.id}...`);

        try {
          if (action === "Unload") {
            await rpc(routerBase, "/models/unload", { model: model.id });
            ctx.ui.notify(`Unloaded ${model.id} from ${name}`, "success");
          } else {
            if (model.status.value !== "loaded") {
              await rpc(routerBase, "/models/load", { model: model.id });
            }

            const registryModel = ctx.modelRegistry.find(name, model.id);
            if (registryModel) {
              const ok = await pi.setModel(registryModel);
              if (ok) {
                ctx.ui.notify(`Switched active model to ${model.id} on ${name}`, "success");
              } else {
                ctx.ui.notify(`Failed to switch active model to ${model.id}`, "error");
              }
            } else {
              ctx.ui.notify(`Model ${model.id} ready, but registry configuration not found.`, "error");
            }
          }
        } catch (e: any) {
          ctx.ui.notify(`Action failed: ${e.message}`, "error");
        } finally {
          ctx.ui.setStatus(name, undefined);
        }
      },
    });
  }
}
