// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startStubMcpServer, registerGithubStub, type StubMcpServer } from "./stub-mcp-server";

let stub: StubMcpServer | undefined;
let client: Client | undefined;
afterEach(async () => {
  await client?.close();
  await stub?.close();
  client = undefined;
  stub = undefined;
});

describe("startStubMcpServer", () => {
  it("serves the registered GitHub tools over a real HTTP transport", async () => {
    stub = await startStubMcpServer(registerGithubStub({ merged: [{ id: "1", prNumber: 1 }] }));
    expect(stub.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
    expect(stub.config).toEqual({ name: "stub-github", transport: { type: "http", url: stub.url } });

    client = new Client({ name: "t", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(stub.url)));
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["list_merged_prs", "list_open_prs"]));

    const res = (await client.callTool({ name: "list_merged_prs", arguments: { author: "x" } })) as {
      content: Array<{ text: string }>;
    };
    expect(JSON.parse(res.content[0].text)).toEqual([{ id: "1", prNumber: 1 }]);
  });
});
