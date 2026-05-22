import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chooseTransport, makeRunner } from "./client-manager";
import { McpTimeoutError } from "./errors";
import type { ServerConfig } from "./server-config";

// Connects an in-memory fake MCP server and returns a connected client.
async function connectFake(register: (s: McpServer) => void): Promise<Client> {
  const server = new McpServer({ name: "fake", version: "1.0.0" });
  register(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

describe("chooseTransport", () => {
  it("picks Streamable HTTP for a url config", () => {
    const cfg: ServerConfig = { name: "x", transport: { type: "http", url: "http://localhost:9/mcp" } };
    expect(chooseTransport(cfg)).toBeInstanceOf(StreamableHTTPClientTransport);
  });
  it("picks stdio for a command config", () => {
    const cfg: ServerConfig = { name: "x", transport: { type: "stdio", command: "node", args: [] } };
    expect(chooseTransport(cfg)).toBeInstanceOf(StdioClientTransport);
  });
});

describe("makeRunner", () => {
  it("lists tool names and calls a tool, returning the raw result", async () => {
    const client = await connectFake((s) => {
      s.registerTool("echo", { inputSchema: { msg: z.string() } }, async (a) => ({ content: [{ type: "text", text: JSON.stringify([{ got: a.msg }]) }] }));
    });
    const runner = makeRunner(client, { serverName: "fake-echo" });
    expect(await runner.listToolNames()).toContain("echo");
    const res = (await runner.callTool("echo", { msg: "hi" })) as { content: Array<{ text: string }> };
    expect(res.content[0].text).toBe(JSON.stringify([{ got: "hi" }]));
    await runner.close();
  });

  it("retries once on a transient error then succeeds", async () => {
    let calls = 0;
    const client = await connectFake((s) => {
      s.registerTool("flaky", { inputSchema: {} }, async () => {
        calls++;
        if (calls === 1) throw new Error("socket hang up");
        return { content: [{ type: "text", text: "[]" }] };
      });
    });
    const runner = makeRunner(client, { serverName: "fake-flaky", retries: 1 });
    await runner.callTool("flaky", {});
    expect(calls).toBe(2);
    await runner.close();
  });

  it("raises McpTimeoutError when a tool exceeds the timeout", async () => {
    const client = await connectFake((s) => {
      s.registerTool("slow", { inputSchema: {} }, async () => {
        await new Promise((r) => setTimeout(r, 200));
        return { content: [{ type: "text", text: "[]" }] };
      });
    });
    const runner = makeRunner(client, { serverName: "fake-slow", timeoutMs: 30, retries: 0 });
    await expect(runner.callTool("slow", {})).rejects.toBeInstanceOf(McpTimeoutError);
    await runner.close();
  });

  it("rejects with the external abort reason (not McpTimeoutError) when the signal aborts", async () => {
    const client = await connectFake((s) => {
      s.registerTool("hang", { inputSchema: {} }, async () => {
        await new Promise((r) => setTimeout(r, 500));
        return { content: [{ type: "text", text: "[]" }] };
      });
    });
    const runner = makeRunner(client, { serverName: "fake-abort", timeoutMs: 5000, retries: 0 });
    const controller = new AbortController();
    const promise = runner.callTool("hang", {}, { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("budget tripped")), 10);
    await expect(promise).rejects.toThrow("budget tripped");
    await expect(promise).rejects.not.toBeInstanceOf(McpTimeoutError);
    await runner.close();
  });
});
