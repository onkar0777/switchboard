import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ServerConfig } from "@/lib/mcp/server-config";

export interface StubMcpServer {
  url: string;
  config: ServerConfig;
  close(): Promise<void>;
}

// Boots a real MCP server behind a real Streamable HTTP transport on an
// ephemeral loopback port. Unlike InMemoryTransport, this exercises the actual
// HTTP fetch path the live client-manager uses — the blind spot Tier 4 covers.
// Stateful session mode (sessionIdGenerator + enableJsonResponse) is required:
// stateless single-transport returns HTTP 500 on the `initialized` notification.
export async function startStubMcpServer(
  register: (server: McpServer) => void,
  name = "stub-github",
): Promise<StubMcpServer> {
  const mcp = new McpServer({ name, version: "1.0.0" });
  register(mcp);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  });
  await mcp.connect(transport);

  const http: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = body ? JSON.parse(body) : undefined;
        await transport.handleRequest(req, res, parsed);
      } catch {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end();
        }
      }
    });
    req.on("error", () => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(0, "127.0.0.1", () => {
      http.off("error", reject);
      resolve();
    });
  });
  const port = (http.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/mcp`;

  return {
    url,
    config: { name, transport: { type: "http", url } },
    async close() {
      await mcp.close();
      http.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        http.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}

export interface GithubStubRows {
  merged?: Array<Record<string, unknown>>;
  open?: Array<Record<string, unknown>>;
}

// Registers the two GitHub-shaped tools the founder widget calls. Canned rows
// are returned verbatim as a JSON text block (the shape parseToolResult reads).
// Args are accepted but ignored — the verdict pipeline does its own
// week-windowing, so returning rows verbatim keeps the canned data explicit.
export function registerGithubStub(rows: GithubStubRows = {}): (server: McpServer) => void {
  const merged = rows.merged ?? [];
  const open = rows.open ?? [];
  const jsonResult = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  });
  return (server) => {
    server.registerTool(
      "list_merged_prs",
      {
        inputSchema: {
          repos: z.array(z.string()).optional(),
          author: z.string().optional(),
          since: z.string().optional(),
          until: z.string().optional(),
        },
      },
      async () => jsonResult(merged),
    );
    server.registerTool(
      "list_open_prs",
      { inputSchema: { repos: z.array(z.string()).optional(), author: z.string().optional() } },
      async () => jsonResult(open),
    );
  };
}

// Registers the real GitHub MCP `search_pull_requests` tool. The founder LIVE
// spec issues two calls against this one tool, distinguished by the search
// qualifier in `query` (`is:merged` vs `is:open`). Rows are returned in GitHub's
// search envelope `{ items: [...] }`, the shape parseToolResult's `items`
// normalizer reads. Canned rows are GitHub-shaped (number/html_url/merged_at/
// created_at/updated_at/base.repo.full_name) so the per-query field map is
// exercised end-to-end over a real transport.
export function registerGithubSearchStub(rows: GithubStubRows = {}): (server: McpServer) => void {
  const merged = rows.merged ?? [];
  const open = rows.open ?? [];
  return (server) => {
    server.registerTool(
      "search_pull_requests",
      {
        inputSchema: {
          query: z.string(),
          owner: z.string().optional(),
          repo: z.string().optional(),
          sort: z.string().optional(),
          order: z.string().optional(),
          perPage: z.number().optional(),
          page: z.number().optional(),
        },
      },
      async ({ query }) => {
        const items = /is:open/.test(query) ? open : merged;
        return { content: [{ type: "text" as const, text: JSON.stringify({ items }) }] };
      },
    );
  };
}
