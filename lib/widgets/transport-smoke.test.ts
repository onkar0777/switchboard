// @vitest-environment node
// Layer 3 — per-widget transport smoke. Each widget's happy `given` is replayed
// once over the REAL stub-MCP HTTP transport (not InMemory), exercising the
// per-MCP parse/drift boundary where the "fetch failed"/drift bugs live.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverWidgetPackages } from "./registry";
import { CasesSchema } from "./cases";
import { loadWidget } from "./load-widget";
import {
  startStubMcpServer,
  registerGithubStub,
  type StubMcpServer,
} from "@/lib/mcp/testkit/stub-mcp-server";
import { openRunner, type McpRunner } from "@/lib/mcp/client-manager";

const NOW = new Date("2026-05-20T12:00:00.000Z");

// Maps a package's MCP server name to a stub registration that serves a happy
// `given` over real HTTP. Extend when a new server type ships a stub.
function stubFor(
  server: string,
  given: Record<string, Array<Record<string, unknown>>>,
): ((server: import("@modelcontextprotocol/sdk/server/mcp.js").McpServer) => void) | null {
  if (server === "github") {
    return registerGithubStub({
      merged: given.merged ?? [],
      open: given.open ?? [],
    });
  }
  return null;
}

let stub: StubMcpServer | undefined;
let runner: McpRunner | undefined;
afterEach(async () => {
  await runner?.close();
  await stub?.close();
  runner = undefined;
  stub = undefined;
});

describe("transport smoke (generic over widgets/*)", () => {
  for (const pkg of discoverWidgetPackages()) {
    const cases = CasesSchema.parse(
      JSON.parse(readFileSync(join(pkg.dir, "golden", "cases.json"), "utf8")),
    );
    const happy = cases.cases.find((c) => c.name === "happy");
    const register =
      happy && "given" in happy ? stubFor(pkg.spec.mcp.server, happy.given) : null;

    if (!register || !happy || !("given" in happy)) {
      it.skip(
        `${pkg.name} — no stub registered for server "${pkg.spec.mcp.server}"`,
        () => {},
      );
      continue;
    }

    it(
      `${pkg.name} — happy given over real transport yields state=ok + verdict literal`,
      async () => {
        stub = await startStubMcpServer(register);
        runner = await openRunner(stub.config);
        const widget = await loadWidget(pkg.spec, NOW, { runner });
        expect(widget.errorMessage).toBeUndefined();
        expect(widget.output.state).toBe("ok");
        if (happy.then.verdict !== undefined) {
          expect(widget.output.verdict).toBe(happy.then.verdict);
        }
      },
    );
  }
});
