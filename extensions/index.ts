import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import openaiSyncExtension from "./openai-sync";
import llamaModelExtension from "./llama-model";

/**
 * Entry point for the Pi Model Manager suite.
 * Consolidates the openai-sync and llama-model extensions into a single module.
 */
export default async function (pi: ExtensionAPI) {
  await openaiSyncExtension(pi);
  await llamaModelExtension(pi);
}
