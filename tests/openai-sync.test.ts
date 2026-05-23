import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, deriveProviderNameFromUrl } from "../extensions/openai-sync";
import registerExtension from "../extensions/openai-sync";

describe("openai-sync URL normalization", () => {
  it("normalizes base URL without trailing slash", () => {
    const res = normalizeUrl("https://api.deepinfra.com/v1");
    assert.equal(res.baseUrl, "https://api.deepinfra.com/v1");
    assert.equal(res.queryUrl, "https://api.deepinfra.com/v1/models");
  });

  it("normalizes base URL with trailing slash", () => {
    const res = normalizeUrl("https://api.deepinfra.com/v1/");
    assert.equal(res.baseUrl, "https://api.deepinfra.com/v1");
    assert.equal(res.queryUrl, "https://api.deepinfra.com/v1/models");
  });

  it("normalizes URL ending with /models", () => {
    const res = normalizeUrl("https://api.deepinfra.com/v1/models");
    assert.equal(res.baseUrl, "https://api.deepinfra.com/v1");
    assert.equal(res.queryUrl, "https://api.deepinfra.com/v1/models");
  });

  it("normalizes URL ending with /models/", () => {
    const res = normalizeUrl("https://api.deepinfra.com/v1/models/");
    assert.equal(res.baseUrl, "https://api.deepinfra.com/v1");
    assert.equal(res.queryUrl, "https://api.deepinfra.com/v1/models");
  });

  it("handles custom local URLs", () => {
    const res = normalizeUrl("http://localhost:8080");
    assert.equal(res.baseUrl, "http://localhost:8080");
    assert.equal(res.queryUrl, "http://localhost:8080/models");
  });
});

describe("openai-sync provider name derivation", () => {
  it("derives provider name from domain", () => {
    const name = deriveProviderNameFromUrl("https://api.together.xyz/v1");
    assert.equal(name, "api-together-xyz");
  });

  it("derives provider name with host and port", () => {
    const name = deriveProviderNameFromUrl("http://localhost:8080");
    assert.equal(name, "localhost-8080");
  });

  it("handles relative URL paths and protocol-less inputs", () => {
    const name = deriveProviderNameFromUrl("api.deepinfra.com/v1/models");
    assert.equal(name, "api-deepinfra-com");
  });
});

describe("openai-sync Extension Registration", () => {
  it("registers the command and tool correctly", () => {
    const registeredCommands: string[] = [];
    let toolRegistered = false;
    let registeredToolName = "";
    let toolRequiredParams: string[] = [];

    const mockPi = {
      registerCommand(name: string, config: any) {
        registeredCommands.push(name);
      },
      registerTool(config: any) {
        toolRegistered = true;
        registeredToolName = config.name;
        toolRequiredParams = config.parameters.required;
      }
    } as any;

    registerExtension(mockPi);

    assert.deepEqual(registeredCommands, ["openai-sync"]);
    assert.equal(toolRegistered, true);
    assert.equal(registeredToolName, "openai_sync");
    assert.deepEqual(toolRequiredParams, ["url"]);
  });

  it("handles slash command arguments correctly", async () => {
    let commandHandler: any = null;
    const mockPi = {
      registerCommand(name: string, config: any) {
        if (name === "openai-sync") {
          commandHandler = config.handler;
        }
      },
      registerTool() {}
    } as any;

    registerExtension(mockPi);
    assert.ok(commandHandler);

    // Test case 1: No arguments
    let notifiedMsg = "";
    let notifiedType = "";
    const mockCtx = {
      ui: {
        notify(msg: string, type: string) {
          notifiedMsg = msg;
          notifiedType = type;
        },
        setStatus() {}
      }
    } as any;

    await commandHandler("", mockCtx);
    assert.equal(notifiedMsg, "Usage: /openai-sync <url> [apiKey]");
    assert.equal(notifiedType, "info");

    // Test case 2: --help
    await commandHandler("--help", mockCtx);
    assert.match(notifiedMsg, /OpenAI Compatibility Sync/);
    assert.equal(notifiedType, "info");
  });
});
