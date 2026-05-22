import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { makeRunner } from "@/lib/mcp/client-manager";
import { MockAdapter } from "@/lib/mcp/mock";
import { buildMcpData } from "./mcp-data";
import { buildContext } from "./ctx";
import { execute } from "./runtime";
import { parsePipeline } from "./dsl";
import { WidgetSpecSchema } from "./spec";
import founderSpecJson from "@/widgets/founder-pr-verdict.spec.json";

const NOW = new Date("2026-05-06T12:00:00.000Z");

afterEach(() => {
  delete process.env.SWITCHBOARD_FORCE_MOCK;
});

async function connectFakeGitHub(): Promise<Client> {
  const server = new McpServer({ name: "fake-github", version: "1.0.0" });
  const mock = new MockAdapter();
  server.registerTool(
    "list_merged_prs",
    { inputSchema: { repos: z.array(z.string()), author: z.string(), since: z.string(), until: z.string() } },
    async (args) => {
      const res = await mock.listMergedPRs(args as never);
      return { content: [{ type: "text", text: JSON.stringify(res.ok ? res.data : []) }] };
    },
  );
  server.registerTool(
    "list_open_prs",
    { inputSchema: { repos: z.array(z.string()), author: z.string() } },
    async (args) => {
      const res = await mock.listOpenPRs(args as never);
      return { content: [{ type: "text", text: JSON.stringify(res.ok ? res.data : []) }] };
    },
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "parity", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

describe("live MCP path — v1 parity", () => {
  it("produces the byte-identical founder verdict through a real client/transport round-trip", async () => {
    delete process.env.SWITCHBOARD_FORCE_MOCK; // force the live path, not the mock short-circuit
    const spec = WidgetSpecSchema.parse(founderSpecJson);
    const ctx = buildContext(spec, NOW);
    const client = await connectFakeGitHub();
    const runner = makeRunner(client, { serverName: "fake-github" });

    const data = await buildMcpData(spec, ctx, { runner });
    const output = execute(
      { verdict: { pipeline: parsePipeline(spec.verdict.pipeline) }, deeplink: spec.deeplink, render: spec.render },
      data,
      ctx,
    );

    expect(output.verdict).toBe("On track: 4/5 PRs this week. 1 PR is stale (waiting >24h).");
    expect(output.status).toBe("good");
    await runner.close();
  });
});
