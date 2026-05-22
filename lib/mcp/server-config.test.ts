import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ServerConfigSchema, loadServerConfig } from "./server-config";
import { McpUnavailableError } from "./errors";

describe("ServerConfigSchema", () => {
  it("parses an http transport config", () => {
    const cfg = ServerConfigSchema.parse({ name: "github", transport: { type: "http", url: "https://example.com/mcp" } });
    expect(cfg.transport.type).toBe("http");
  });

  it("parses a stdio transport config and defaults args to []", () => {
    const cfg = ServerConfigSchema.parse({ name: "github", transport: { type: "stdio", command: "npx" } });
    expect(cfg.transport.type).toBe("stdio");
    if (cfg.transport.type === "stdio") expect(cfg.transport.args).toEqual([]);
  });

  it("rejects an unknown transport type", () => {
    expect(() => ServerConfigSchema.parse({ name: "x", transport: { type: "carrier-pigeon" } })).toThrow();
  });
});

describe("loadServerConfig", () => {
  it("loads and parses mcp/<name>.json from the given dir", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "sb-mcp-"));
    await writeFile(path.join(dir, "github.json"), JSON.stringify({ name: "github", transport: { type: "http", url: "https://example.com/mcp" } }));
    const cfg = await loadServerConfig("github", dir);
    expect(cfg.name).toBe("github");
    await rm(dir, { recursive: true, force: true });
  });

  it("throws McpUnavailableError when the config file is missing", async () => {
    await expect(loadServerConfig("nope", path.join(tmpdir(), "does-not-exist-sb"))).rejects.toBeInstanceOf(McpUnavailableError);
  });
});
