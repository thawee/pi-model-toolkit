import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  type PiModelsJson,
  type PiModelEntry,
  MODELS_JSON_PATH as MODELS_FILE,
  readModelsJson,
  readModifyWriteModelsJson,
  isReasoningModel,
  detectModelFamily,
  withRetry,
  EXTENSION_VERSION,
} from "../shared/ollama";
import { mergeModels } from "../shared/provider-sync";
import { section, ok, fail, warn, info } from "../shared/format";

// ── Branding ──────────────────────────────────────────────────────────────

const BRANDING = [
  `  ⚡ Pi Custom Models Suite v${EXTENSION_VERSION}`,
  `  OpenAI Compatibility Sync`,
  `  Written by thawee — https://github.com/thawee`,
].join("\n");

// ── Helpers ────────────────────────────────────────────────────────────────

interface OpenAIModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
}

/**
 * Normalize the URL input, extracting query URL (/models) and the stored baseUrl.
 */
export function normalizeUrl(inputUrl: string): { queryUrl: string; baseUrl: string } {
  let clean = inputUrl.trim().replace(/\/+$/, "");
  let queryUrl: string;
  let baseUrl: string;

  if (clean.endsWith("/models")) {
    queryUrl = clean;
    baseUrl = clean.slice(0, -7).replace(/\/+$/, "");
  } else {
    baseUrl = clean;
    queryUrl = `${clean}/models`;
  }
  return { queryUrl, baseUrl };
}

/**
 * Derive provider name from the host and port of the URL.
 */
export function deriveProviderNameFromUrl(inputUrl: string): string {
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

/**
 * Fetch models from the OpenAI-compatible API.
 */
export async function fetchOpenAIModels(queryUrl: string, apiKey?: string): Promise<OpenAIModel[]> {
  return withRetry(async () => {
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const res = await fetch(queryUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`API returned ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as { data?: OpenAIModel[] };
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid response format: 'data' array not found");
    }
    return data.data;
  });
}

function getProviderConfig(existing: PiModelsJson, providerName: string, baseUrl: string, apiKey?: string) {
  const prov = existing.providers[providerName];
  return {
    baseUrl: prov?.baseUrl ?? baseUrl,
    api: prov?.api ?? "openai-completions",
    apiKey: apiKey ?? prov?.apiKey ?? "openai",
    compat: prov?.compat ?? {
      supportsDeveloperRole: true,
      supportsReasoningEffort: false,
    },
  };
}

// ── Shared sync result type ───────────────────────────────────────────────

interface SyncResult {
  providerName: string;
  baseUrl: string;
  newModels: PiModelEntry[];
  added: PiModelEntry[];
  removed: string[];
  error?: string;
}

// ── Core sync logic ─────────────────────────────────────────────────────────

async function performSync(
  providerName?: string,
  inputUrl?: string,
  apiKey?: string
): Promise<SyncResult> {
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
        // Ignore errors reading models.json at this stage
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
        error: `No existing configuration found for provider "${finalProviderName}". Please specify a URL.`,
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
        error: "No models found in the API response",
      };
    }

    const newModels: PiModelEntry[] = rawModels.map((m) => ({
      id: m.id,
      reasoning: isReasoningModel(m.id),
      modelFamily: detectModelFamily(m.id),
    }));

    let added: PiModelEntry[] = [];
    let removed: string[] = [];

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
        models: mergedModels,
      };

      return existing;
    });

    return {
      providerName: finalProviderName,
      baseUrl: finalBaseUrl,
      newModels,
      added,
      removed,
    };
  } catch (err: any) {
    return {
      providerName: finalProviderName,
      baseUrl: finalBaseUrl,
      newModels: [],
      added: [],
      removed: [],
      error: err.message,
    };
  }
}

// ── Extension ─────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── Slash command: /openai-sync ────────────────────────────────────────

  pi.registerCommand("openai-sync", {
    description: "Sync available models from an OpenAI-compatible API (e.g. Ollama, llama.cpp, Together AI) into your Pi configuration. Use: /openai-sync <url> [apiKey]",
    detailedHelp: "\n\n🔄 OpenAI Compatibility Sync (Pi Custom Models Suite)\n\nSynchronizes available models from any OpenAI-compatible API\n(such as Ollama, llama.cpp, Together AI, DeepInfra, etc.)\ninto Pi's models.json configuration file.\n\n📋 Usage:\n  /openai-sync <url> [apiKey] - Sync with URL (provider derived automatically from host/port)\n  /openai-sync --help         - Show this help\n\n🔧 Features:\n• Reasoning model auto-detection\n• Model family auto-detection\n• Atomic configuration updates\n• Compatible with local instances (Ollama, llama.cpp)\n• Compatible with cloud providers (Together AI, DeepInfra)\n",
    async handler(args: string, ctx: any) {
      if (args.trim() === "--help") {
        ctx.ui.notify(
          "🔄 OpenAI Compatibility Sync (Pi Custom Models Suite)\n\n" +
          "📋 Usage:\n" +
          "  /openai-sync <url> [apiKey] - Sync with URL (provider derived automatically from host/port)\n" +
          "  /openai-sync --help         - Show this help\n\n" +
          "🔧 Compatibility & Features:\n" +
          "• Works with Ollama, llama.cpp, and other local/remote OpenAI-compatible APIs\n" +
          "• Reasoning model auto-detection\n" +
          "• Model family auto-detection\n" +
          "• Atomic configuration updates\n",
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
      const apiKey = parts[1] !== "undefined" ? parts[1] : undefined;
      const providerName = deriveProviderNameFromUrl(url);

      ctx.ui.setStatus("openai-sync", "Fetching models...");

      try {
        const result = await performSync(providerName, url, apiKey);

        if (result.error) {
          ctx.ui.notify(result.error, "error");
          ctx.ui.setStatus("openai-sync", undefined);
          return;
        }

        const { baseUrl, newModels, added, removed, providerName: finalProvider } = result;

        const lines: string[] = [""];
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
          lines.push(info("No changes — already in sync"));
        }

        lines.push("");
        lines.push(`  Written to ${MODELS_FILE}`);
        lines.push(`  Run /reload to pick up changes`);
        lines.push(BRANDING);

        const report = lines.join("\n");

        const summary: string[] = [`Synced ${newModels.length} models to ${finalProvider}`];
        if (added.length > 0) summary.push(`+${added.map((m) => m.id).join(", ")}`);
        if (removed.length > 0) summary.push(`-${removed.join(", ")}`);
        ctx.ui.notify(summary.join(" · "), "success");

        pi.sendMessage({
          customType: "openai-sync-report",
          content: report,
          display: { type: "content", content: report },
          details: { timestamp: new Date().toISOString(), added: added.length, removed: removed.length },
        });
      } catch (err: any) {
        ctx.ui.notify(`Failed: ${err.message}`, "error");
      }

      ctx.ui.setStatus("openai-sync", undefined);
    },
  });

  // ── Tool: openai_sync ──────────────────────────────────────────────────

  pi.registerTool({
    name: "openai_sync",
    label: "OpenAI Compatibility Sync",
    description:
      "Synchronize available models from an OpenAI-compatible server into Pi's configuration.\n\n" +
      BRANDING,
    parameters: {
      type: "object",
      properties: {
        provider: {
          type: "string",
          description: "Optional target provider key in models.json (e.g., deepinfra, together). Derived from url if omitted.",
        },
        url: {
          type: "string",
          description: "OpenAI-compatible base URL (e.g. https://api.deepinfra.com/v1)",
        },
        apiKey: {
          type: "string",
          description: "Optional API Bearer token.",
        },
      },
      required: ["url"],
    } as any,
    async execute(_toolCallId: string, params: any, _signal: AbortSignal, _onUpdate: any, _ctx: any) {
      const provider = (params as any)?.provider as string | undefined;
      const url = (params as any)?.url as string;
      const apiKey = (params as any)?.apiKey as string | undefined;

      const result = await performSync(provider, url, apiKey);

      if (result.error) {
        return {
          content: [{ type: "text", text: `Error: ${result.error}` }],
          details: {},
        };
      }

      const { providerName, baseUrl, newModels } = result;

      const modelDetails = newModels
        .map((m) => `  • ${m.id} (reasoning: ${m.reasoning}, family: ${m.modelFamily})`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `${BRANDING}\n\nSynced ${newModels.length} models from ${baseUrl} to provider "${providerName}" in ${MODELS_FILE}.\n\n${modelDetails}`,
          },
        ],
        details: { models: newModels, provider: providerName },
      };
    },
  });
}
