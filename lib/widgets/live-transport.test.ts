// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { startStubMcpServer, registerGithubStub, type StubMcpServer } from "@/lib/mcp/testkit/stub-mcp-server";
import { openRunner, type McpRunner } from "@/lib/mcp/client-manager";
import { buildMcpData } from "@/lib/widgets/mcp-data";
import { buildContext } from "@/lib/widgets/ctx";
import { WidgetSpecSchema } from "@/lib/widgets/spec";
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

  it.todo("AC2: loadWidget over real transport yields state=ok and a 'Shipped: 5/5' verdict");
  it.todo("AC3: loadWidget over real transport with no data yields state=empty and no error");
  it.todo("AC4: an unreachable MCP url surfaces as 'Couldn't compute: fetch failed'");
});
