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
    try {
      await writeFile(path.join(dir, "github.json"), JSON.stringify({ name: "github", transport: { type: "http", url: "https://example.com/mcp" } }));
      const cfg = await loadServerConfig("github", dir);
      expect(cfg.name).toBe("github");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws McpUnavailableError when the config file is missing", async () => {
    await expect(loadServerConfig("nope", path.join(tmpdir(), "does-not-exist-sb"))).rejects.toBeInstanceOf(McpUnavailableError);
  });

  it("throws McpUnavailableError when the config file contains non-JSON content", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "sb-mcp-"));
    try {
      await writeFile(path.join(dir, "bad.json"), "not-json");
      await expect(loadServerConfig("bad", dir)).rejects.toBeInstanceOf(McpUnavailableError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws McpUnavailableError when the config file fails schema validation", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "sb-mcp-"));
    try {
      await writeFile(path.join(dir, "invalid.json"), JSON.stringify({ name: "x" }));
      await expect(loadServerConfig("invalid", dir)).rejects.toBeInstanceOf(McpUnavailableError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("interpolates ${ENV} references in header values from the environment", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "sb-mcp-"));
    process.env.SB_TEST_PAT = "ghp_secret_token";
    try {
      await writeFile(
        path.join(dir, "github.json"),
        JSON.stringify({
          name: "github",
          transport: { type: "http", url: "https://api.githubcopilot.com/mcp/", headers: { Authorization: "Bearer ${SB_TEST_PAT}" } },
        }),
      );
      const cfg = await loadServerConfig("github", dir);
      if (cfg.transport.type === "http") {
        expect(cfg.transport.headers?.Authorization).toBe("Bearer ghp_secret_token");
      }
    } finally {
      delete process.env.SB_TEST_PAT;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws McpUnavailableError when a referenced ${ENV} variable is unset", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "sb-mcp-"));
    delete process.env.SB_MISSING_PAT;
    try {
      await writeFile(
        path.join(dir, "github.json"),
        JSON.stringify({
          name: "github",
          transport: { type: "http", url: "https://api.githubcopilot.com/mcp/", headers: { Authorization: "Bearer ${SB_MISSING_PAT}" } },
        }),
      );
      await expect(loadServerConfig("github", dir)).rejects.toBeInstanceOf(McpUnavailableError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
