// @vitest-environment node
// Layer 2 — generic golden runner, parametrized over every discovered package.
// Content is per-widget data (golden/cases.json); the runner is generic.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverWidgetPackages } from "./registry";
import { CasesSchema, type WidgetCase } from "./cases";
import { givenToPipelineInput } from "./given-loader";
import { parsePipeline } from "./dsl";
import { buildContext } from "./ctx";
import { execute } from "./runtime";
import { loadWidget } from "./load-widget";
import { McpUnauthorizedError } from "@/lib/mcp/errors";

const FROZEN_NOW = new Date("2026-05-20T12:00:00.000Z");

function runDataCase(spec: ReturnType<typeof discoverWidgetPackages>[number]["spec"], c: Extract<WidgetCase, { given: unknown }>) {
  const ctx = buildContext(spec, FROZEN_NOW);
  return execute(
    { verdict: { pipeline: parsePipeline(spec.verdict.pipeline) }, deeplink: spec.deeplink, render: spec.render },
    givenToPipelineInput(c.given),
    ctx,
  );
}

describe("golden semantics (generic over widgets/*)", () => {
  for (const pkg of discoverWidgetPackages()) {
    const cases = CasesSchema.parse(JSON.parse(readFileSync(join(pkg.dir, "golden", "cases.json"), "utf8")));
    describe(pkg.name, () => {
      for (const c of cases.cases) {
        it(c.name, async () => {
          if ("fault" in c) {
            // Fault cases need every query's tool present so drift passes, then callTool throws.
            const tools = Object.values(pkg.spec.mcp.queries).map((q) => q.tool);
            const runner = {
              listToolNames: async () => tools,
              callTool: async () => {
                if (c.fault === "unauthorized") throw new McpUnauthorizedError(pkg.spec.mcp.server);
                throw new Error("tool blew up");
              },
              close: async () => {},
            };
            const widget = await loadWidget(pkg.spec, FROZEN_NOW, { runner });
            expect(widget.output.state).toBe(c.then.state);
            return;
          }
          const out = runDataCase(pkg.spec, c);
          const { then } = c;
          expect(out.state).toBe(then.state);
          if (then.value !== undefined) expect(out.value).toBe(then.value);
          if (then.verdict !== undefined) expect(out.verdict).toBe(then.verdict);
          if (then.status !== undefined) expect(out.status).toBe(then.status);
          if (then.momentum !== undefined) expect(out.momentum).toEqual(then.momentum);
          if (then.action !== undefined) expect(out.slots.action ?? null).toBe(then.action);
          if (then.slotIds !== undefined) {
            expect(Object.keys(out.slots).filter((k) => k !== "from")).toEqual(then.slotIds);
          }
        });
      }
    });
  }
});
