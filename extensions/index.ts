import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import openaiCompatSync from "./openai-sync";

/**
 * Entry point for the OpenAI Toolkit.
 */
export default async function (pi: ExtensionAPI) {
  console.log("⚡ OpenAI Toolkit loading...");
  await openaiCompatSync(pi);
  console.log("✅ OpenAI Toolkit ready");
}
