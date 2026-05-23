// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { startStubMcpServer, registerGithubStub, type StubMcpServer } from "@/lib/mcp/testkit/stub-mcp-server";
import { openRunner, type McpRunner } from "@/lib/mcp/client-manager";
import { buildMcpData } from "@/lib/widgets/mcp-data";
import { buildContext } from "@/lib/widgets/ctx";
import { WidgetSpecSchema } from "@/lib/widgets/spec";
import { loadWidget } from "@/lib/widgets/load-widget";
import { describeMcpError } from "@/lib/mcp/errors";
import type { ServerConfig } from "@/lib/mcp/server-config";
import founderSpecJson from "@/widgets/founder-pr-verdict.spec.json";

const NOW = new Date("2026-05-20T12:00:00.000Z");
const spec = WidgetSpecSchema.parse(founderSpecJson);
const ctx = buildContext(spec, NOW);

// Five merged PRs inside the current week (mergedAt = weekStartIso passes the
// pipeline's gte/lte window filter), in a repo the spec queries.
const mergedRows = Array.from({ length: 5 }, (_, i) => ({
  id: String(i + 1),
  title: `PR ${i + 1}`,
  url: `https://github.com/onkarsingh/switchboard/pull/${i + 1}`,
  repo: "onkarsingh/switchboard",
  prNumber: i + 1,
  mergedAt: ctx.weekStartIso,
  openedAt: ctx.fourWeeksAgoIso,
}));

let stub: StubMcpServer | undefined;
let runner: McpRunner | undefined;
afterEach(async () => {
  await runner?.close();
  await stub?.close();
  runner = undefined;
  stub = undefined;
});

describe("Tier 4 — live transport acceptance", () => {
  it("AC1: buildMcpData returns canned rows through openRunner over a real HTTP transport", async () => {
    stub = await startStubMcpServer(registerGithubStub({ merged: mergedRows, open: [] }));
    runner = await openRunner(stub.config); // REAL transport, not InMemory
    const data = await buildMcpData(spec, ctx, { runner });
    expect(data.queries.merged).toEqual(mergedRows);
    expect(data.queries.open).toEqual([]);
  });

  it("AC2: loadWidget over real transport yields state=ok and a 'Shipped: 5/5' verdict", async () => {
    stub = await startStubMcpServer(registerGithubStub({ merged: mergedRows, open: [] }));
    runner = await openRunner(stub.config);
    const widget = await loadWidget(spec, NOW, { runner });
    expect(widget.output.state).toBe("ok");
    expect(widget.output.value).toBe(5);
    expect(widget.output.verdict).toContain("Shipped: 5/5");
    expect(widget.errorMessage).toBeUndefined();
  });

  it("AC3: loadWidget over real transport with no data renders the authored zero verdict (state=ok)", async () => {
    // The founder verdict_card computes a meaningful verdict from zero — it is
    // not suppressed to state=empty (that's reserved for the `list` template).
    stub = await startStubMcpServer(registerGithubStub({ merged: [], open: [] }));
    runner = await openRunner(stub.config);
    const widget = await loadWidget(spec, NOW, { runner });
    expect(widget.output.state).toBe("ok");
    expect(widget.output.value).toBe(0);
    expect(widget.output.verdict).toContain("Behind: 0/5");
    expect(widget.output.verdict).toContain("the week is yours");
    expect(widget.errorMessage).toBeUndefined();
  });
  it("AC4: an unreachable MCP url surfaces as 'Couldn't compute: fetch failed'", async () => {
    const unreachable: ServerConfig = {
      name: "github",
      transport: { type: "http", url: "https://example.invalid/github-mcp" },
    };
    // The real client-manager attempts a real fetch and rejects fast.
    const err = await openRunner(unreachable).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/fetch failed/i);
    expect(describeMcpError(err, "github")).toBe("Couldn't compute: fetch failed");
  });
});
