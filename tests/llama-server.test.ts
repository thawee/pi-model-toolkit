import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { resolveUrl } from "../extensions/llama-server";
import registerExtension from "../extensions/llama-server";

describe("llama-server resolveUrl resolution hierarchy", () => {
  const tempDir = path.join(os.tmpdir(), `pi-llama-test-${Date.now()}`);

  before(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.LLAMA_SERVER_URL;
  });

  it("resolves to default when no config or env is present", () => {
    delete process.env.LLAMA_SERVER_URL;
    const url = resolveUrl(tempDir);
    assert.equal(url, "http://127.0.0.1:8080");
  });

  it("resolves to env variable when present", () => {
    process.env.LLAMA_SERVER_URL = "http://192.168.1.100:9999/";
    const url = resolveUrl(tempDir);
    assert.equal(url, "http://192.168.1.100:9999");
  });

  it("resolves to per-project config file when present (highest precedence)", () => {
    process.env.LLAMA_SERVER_URL = "http://192.168.1.100:9999";
    const piDir = path.join(tempDir, ".pi");
    fs.mkdirSync(piDir, { recursive: true });
    fs.writeFileSync(
      path.join(piDir, "llama-server.json"),
      JSON.stringify({ url: "http://10.0.0.5:9090/" }),
      "utf8"
    );

    const url = resolveUrl(tempDir);
    assert.equal(url, "http://10.0.0.5:9090");
  });
});

describe("llama-server Extension Registration", () => {
  it("registers offline fallback models command if server is offline during start", async () => {
    const registeredCommands: string[] = [];
    let registeredProvider = false;

    const mockPi = {
      registerCommand(name: string, config: any) {
        registeredCommands.push(name);
      },
      registerProvider() {
        registeredProvider = true;
      },
      registerTool() {},
      on() {},
    } as any;

    // Use a completely bogus URL that will definitely fail fetching
    process.env.LLAMA_SERVER_URL = "http://127.0.0.1:65530";
    await registerExtension(mockPi);

    assert.deepEqual(registeredCommands, ["llama-server"]);
    assert.equal(registeredProvider, false);
  });
});
