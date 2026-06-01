// ~/.pi/agent/extensions/llama-server.ts
// Pi extension for llama-server router integration
//
// Configure per-project via .pi/llama-server.json:
//   { "url": "http://10.0.0.5:9090" }
//
// Or globally via env: LLAMA_SERVER_URL=http://host:port
// Defaults to http://127.0.0.1:8080

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { section, ok, fail, warn, info } from "../shared/format";
import { EXTENSION_VERSION } from "../shared/ollama";

// ── Branding ──────────────────────────────────────────────────────────────
const BRANDING = [
  `  ⚡ Llama Toolkit v${EXTENSION_VERSION}`,
  `  llama.cpp Router Management`,
  `  Written by thawee — https://github.com/thawee`,
].join("\n");

/**
 * Resolve the llama-server base URL using priority chain.
 */
export function resolveUrl(cwd: string): string {
  // 1. per-project config
  try {
    const raw = readFileSync(join(cwd, ".pi", "llama-server.json"), "utf-8");
    const cfg = JSON.parse(raw);
    if (cfg.url) {
      return cfg.url.trim().replace(/\/+$/, "");
    }
  } catch {
    // file doesn't exist or isn't valid JSON — that's fine
  }
  // 2. env, 3. default
  const envUrl = process.env.LLAMA_SERVER_URL;
  if (envUrl) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "http://127.0.0.1:8080";
}

/**
 * Standard fetch wrapper for JSON RPC operations.
 */
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

export interface ServerModel {
  id: string;
  status: { value: string };
}

/**
 * Retrieve models from the llama-server.
 */
export async function listModels(base: string): Promise<ServerModel[]> {
  const data = (await rpc(base, "/models")) as {
    data?: ServerModel[];
  };
  return (data.data ?? []).filter(
    (m) => m.id && m.id !== "llama-server" && m.id !== "main"
  );
}

export default async function (pi: ExtensionAPI) {
  const cwd = process.cwd();

  // ---- fetch & register ----
  const url = resolveUrl(cwd);
  let serverModels: ServerModel[];

  try {
    serverModels = await listModels(url);
  } catch (e) {
    // Gracefully handle unreachable server on startup
    pi.registerCommand("llama-server", {
      description: "Manage, load, and switch models on a live llama.cpp server running in router mode (offline)",
      handler: async (_args: string, ctx: any) => {
        ctx.ui.notify(
          `llama-server unreachable at ${resolveUrl(ctx.cwd)}`,
          "error"
        );
      },
    });
    return;
  }

  const modelDefs = serverModels.map((m) => ({
    id: String(m.id),
    name: String(m.id),
    reasoning: false,
    input: ["text"] as const,
    contextWindow: 128000,
    maxTokens: 16384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }));

  if (modelDefs.length > 0) {
    pi.registerProvider("llama-server", {
      baseUrl: `${url}/v1`,
      api: "openai-completions",
      apiKey: "not-needed",
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
      },
      models: modelDefs,
    });
  }

  // ---- model_select: tell server to load ----
  pi.on("model_select", async (event: any, ctx: any) => {
    if (event.model.provider !== "llama-server") return;
    try {
      await rpc(resolveUrl(ctx.cwd), "/models/load", {
        model: event.model.id,
      });
    } catch {
      // server may have autoload
    }
  });

  // ---- /llama-server — live browser ----
  pi.registerCommand("llama-server", {
    description: "Manage, load, and switch models on a live llama.cpp server running in router mode",
    handler: async (_args: string, ctx: any) => {
      const base = resolveUrl(ctx.cwd);
      let models: ServerModel[];
      try {
        models = await listModels(base);
      } catch (e: any) {
        ctx.ui.notify(`llama-server unreachable: ${e.message}`, "error");
        return;
      }

      if (models.length === 0) {
        ctx.ui.notify("No models loaded on the llama-server", "info");
        return;
      }

      // Dynamically register/update provider models so the registry is always fresh
      const modelDefs = models.map((m) => ({
        id: String(m.id),
        name: String(m.id),
        reasoning: false,
        input: ["text"] as const,
        contextWindow: 128000,
        maxTokens: 16384,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      }));

      pi.registerProvider("llama-server", {
        baseUrl: `${base}/v1`,
        api: "openai-completions",
        apiKey: "not-needed",
        compat: {
          supportsDeveloperRole: false,
          supportsReasoningEffort: false,
        },
        models: modelDefs,
      });

      const labels = models.map((m) => {
        const c =
          m.status.value === "loaded" ? "🟢"
          : m.status.value === "loading" ? "🟡"
          : m.status.value === "failed" ? "🔴"
          : "⚪";
        return `${c} ${m.id}`;
      });

      const choice = await ctx.ui.select("llama-server models:", labels);
      if (choice == null) return;

      const idx = labels.indexOf(choice);
      const model = models[idx];

      const actions =
        model.status.value === "loaded"
          ? ["Switch", "Unload", "Cancel"]
          : ["Load & switch", "Cancel"];

      const action = await ctx.ui.select(`${model.id}`, actions);
      if (!action || action === "Cancel") return;

      ctx.ui.setStatus("llama-server", `${action === "Unload" ? "Unloading" : "Loading"} ${model.id}...`);

      try {
        if (action === "Unload") {
          await rpc(base, "/models/unload", { model: model.id });
          ctx.ui.notify(`Unloaded ${model.id}`, "success");
        } else {
          if (model.status.value !== "loaded") {
            await rpc(base, "/models/load", { model: model.id });
          }

          // Fetch model registry entry and set it active
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
      } catch (e: any) {
        ctx.ui.notify(`Action failed: ${e.message}`, "error");
      } finally {
        ctx.ui.setStatus("llama-server", undefined);
      }
    },
  });
}
