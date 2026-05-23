// @vitest-environment node
//
// Tier 4 — acceptance for the LIVE founder spec wired to the real GitHub MCP
// tool `search_pull_requests`. Exercised over a real HTTP transport with
// GitHub-shaped rows so the per-query field map (GitHub fields -> canonical
// row) and the hoursSinceUpdate derivation are proven end-to-end. This is the
// regression guard for the "first page load shows Couldn't compute: fetch
// failed" bug: a reachable GitHub-shaped server must render an ok verdict.
import { afterEach, describe, expect, it } from "vitest";
import { startStubMcpServer, registerGithubSearchStub, type StubMcpServer } from "@/lib/mcp/testkit/stub-mcp-server";
import { openRunner, type McpRunner } from "@/lib/mcp/client-manager";
import { buildContext } from "@/lib/widgets/ctx";
import { WidgetSpecSchema } from "@/lib/widgets/spec";
import { loadWidget } from "@/lib/widgets/load-widget";
import liveSpecJson from "@/widgets/founder-pr-verdict.live.spec.json";

const NOW = new Date("2026-05-20T12:00:00.000Z");
const spec = WidgetSpecSchema.parse(liveSpecJson);
const ctx = buildContext(spec, NOW);

// Five PRs merged inside the current week, in GitHub's minimal PR shape as
// returned by search_pull_requests. merged_at lands on weekStartIso so the
// pipeline's gte/lte week-window filter keeps all five.
const mergedItems = Array.from({ length: 5 }, (_, i) => ({
  number: 100 + i,
  title: `PR ${i + 1}`,
  state: "closed",
  merged: true,
  html_url: `https://github.com/onkar0777/casesahayak/pull/${100 + i}`,
  created_at: ctx.fourWeeksAgoIso,
  updated_at: ctx.weekStartIso,
  merged_at: ctx.weekStartIso,
  user: { login: "onkar0777" },
  base: { repo: { full_name: "onkar0777/casesahayak" } },
}));

// One open PR that has been stale for >24h (updated_at four weeks ago).
const openItems = [
  {
    number: 200,
    title: "Long-running refactor",
    state: "open",
    merged: false,
    html_url: "https://github.com/onkar0777/casesahayak/pull/200",
    created_at: ctx.fourWeeksAgoIso,
    updated_at: ctx.fourWeeksAgoIso,
    user: { login: "onkar0777" },
    base: { repo: { full_name: "onkar0777/casesahayak" } },
  },
];

let stub: StubMcpServer | undefined;
let runner: McpRunner | undefined;
afterEach(async () => {
  await runner?.close();
  await stub?.close();
  runner = undefined;
  stub = undefined;
});

describe("Tier 4 — live founder spec over the real search_pull_requests tool", () => {
  it("renders an ok 'Shipped: 5/5' verdict from GitHub-shaped rows", async () => {
    stub = await startStubMcpServer(registerGithubSearchStub({ merged: mergedItems, open: openItems }));
    runner = await openRunner(stub.config);
    const widget = await loadWidget(spec, NOW, { runner });

    expect(widget.errorMessage).toBeUndefined();
    expect(widget.output.state).toBe("ok");
    expect(widget.output.value).toBe(5);
    expect(widget.output.verdict).toContain("Shipped: 5/5");
  });

  it("maps GitHub fields to canonical receipt rows with a working deeplink", async () => {
    stub = await startStubMcpServer(registerGithubSearchStub({ merged: mergedItems, open: [] }));
    runner = await openRunner(stub.config);
    const widget = await loadWidget(spec, NOW, { runner });

    const receipts = widget.output.slots.receipts as Array<Record<string, unknown>>;
    expect(receipts).toHaveLength(5);
    expect(receipts[0].prNumber).toBe(100);
    expect(receipts[0].repo).toBe("onkar0777/casesahayak");
    expect(receipts[0].url).toBe("https://github.com/onkar0777/casesahayak/pull/100");
    // The runtime builds the deeplink (template "{url}") onto the `from` rows.
    expect(widget.output.rows[0].deeplink).toBe("https://github.com/onkar0777/casesahayak/pull/100");
  });

  it("derives numeric hoursSinceUpdate on drag rows from updated_at", async () => {
    stub = await startStubMcpServer(registerGithubSearchStub({ merged: mergedItems, open: openItems }));
    runner = await openRunner(stub.config);
    const widget = await loadWidget(spec, NOW, { runner });

    const drag = widget.output.slots.drag as Array<Record<string, unknown>>;
    expect(drag).toHaveLength(1);
    expect(typeof drag[0].hoursSinceUpdate).toBe("number");
    expect(drag[0].hoursSinceUpdate as number).toBeGreaterThan(24);
  });

  it("never surfaces 'Couldn't compute: fetch failed' for a reachable server (the live bug)", async () => {
    stub = await startStubMcpServer(registerGithubSearchStub({ merged: mergedItems, open: openItems }));
    runner = await openRunner(stub.config);
    const widget = await loadWidget(spec, NOW, { runner });

    expect(widget.output.state).not.toBe("error");
    expect(widget.errorMessage ?? "").not.toMatch(/fetch failed/i);
  });
});
