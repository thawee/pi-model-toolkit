import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import llamaServerExtension from "./llama-server";

/**
 * Entry point for the Llama Toolkit.
 */
export default async function (pi: ExtensionAPI) {
  await llamaServerExtension(pi);
}
