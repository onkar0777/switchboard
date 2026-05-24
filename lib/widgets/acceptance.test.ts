// @vitest-environment node
// Phase 0 — acceptance criteria for the golden widget test architecture.
// Each is skipped (it.skip) and un-skipped by the phase that implements it.
// They assert at stable boundaries: the discovered package set, execute() output,
// loadWidget state, and the deleted-symbol surface.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { discoverWidgetPackages, KNOWN_WIDGET_MIN } from "./registry";
import { CasesSchema } from "./cases";
import { givenToPipelineInput } from "./given-loader";
import { parsePipeline } from "./dsl";
import { buildContext } from "./ctx";
import { execute } from "./runtime";
import { loadWidget } from "./load-widget";
import { startStubMcpServer, registerGithubStub } from "@/lib/mcp/testkit/stub-mcp-server";
import { openRunner } from "@/lib/mcp/client-manager";

const NOW = new Date("2026-05-20T12:00:00.000Z");
function exec(name: string, caseName: string) {
  const pkg = discoverWidgetPackages().find((p) => p.name === name)!;
  const cases = CasesSchema.parse(JSON.parse(readFileSync(join(pkg.dir, "golden", "cases.json"), "utf8")));
  const c = cases.cases.find((x) => x.name === caseName)!;
  if (!("given" in c)) throw new Error("not a data case");
  return execute({ verdict: { pipeline: parsePipeline(pkg.spec.verdict.pipeline) }, deeplink: pkg.spec.deeplink, render: pkg.spec.render }, givenToPipelineInput(c.given), buildContext(pkg.spec, NOW));
}

describe("AC1 — structure suite over any registered widget", () => {
  it("discovers at least the known minimum and the founder package validates", () => {
    const pkgs = discoverWidgetPackages();
    expect(pkgs.length).toBeGreaterThanOrEqual(KNOWN_WIDGET_MIN);
    expect(pkgs.some((p) => p.name === "founder-pr-verdict")).toBe(true);
  });
});
describe("AC2 — golden semantics from given → then", () => {
  it("matches the founder happy verdict literal + status", () => {
    const out = exec("founder-pr-verdict", "happy");
    expect(out.verdict).toBe("Shipped: 5/5 PRs this week.");
    expect(out.status).toBe("good");
    expect(out.value).toBe(5);
  });
});
describe("AC3 — empty state", () => {
  it("empty given yields the authored zero verdict, not a false one", () => {
    const out = exec("founder-pr-verdict", "empty");
    expect(out.value).toBe(0);
    expect(out.verdict).toContain("the week is yours");
  });
});
describe("AC4 — transport smoke per widget", () => {
  it("founder happy given over real stub-MCP yields state=ok + 'Shipped: 5/5'", async () => {
    const pkg = discoverWidgetPackages().find((p) => p.name === "founder-pr-verdict")!;
    const cs = CasesSchema.parse(JSON.parse(readFileSync(join(pkg.dir, "golden", "cases.json"), "utf8")));
    const happy = cs.cases.find((c) => c.name === "happy")!;
    if (!("given" in happy)) throw new Error("happy data case required");
    const stub = await startStubMcpServer(registerGithubStub({ merged: happy.given.merged, open: happy.given.open ?? [] }));
    const runner = await openRunner(stub.config);
    try {
      const widget = await loadWidget(pkg.spec, new Date("2026-05-20T12:00:00.000Z"), { runner });
      expect(widget.output.state).toBe("ok");
      expect(widget.output.verdict).toBe("Shipped: 5/5 PRs this week.");
    } finally {
      await runner.close();
      await stub.close();
    }
  });
});
describe("AC5 — no v1 oracle", () => {
  it("computeVerdict and the parity tests no longer exist", () => {
    const root = process.cwd();
    expect(existsSync(resolve(root, "lib/verdicts/engine.ts"))).toBe(false);
    expect(existsSync(resolve(root, "lib/widgets/runtime.parity.test.ts"))).toBe(false);
    expect(existsSync(resolve(root, "lib/widgets/mcp-data.parity.test.ts"))).toBe(false);
  });
});
