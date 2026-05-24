// @vitest-environment node
// Layer 1 — structural conformance, generic over every discovered package.
// Zero per-widget code: schema, pipeline parse, slot contract, deeplink shape,
// the DESIGN.md color rule, the required-case-set, and the anti empty-glob
// min-count guard. (State transitions are driven in golden.test.ts, not here.)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverWidgetPackages, KNOWN_WIDGET_MIN } from "./registry";
import { WidgetSpecSchema } from "./spec";
import { parsePipeline } from "./dsl";
import { validateSlots, type TemplateName } from "./template-slots";
import { buildContext } from "./ctx";
import { execute } from "./runtime";
import { givenToPipelineInput } from "./given-loader";
import { CasesSchema, REQUIRED_CASE_NAMES } from "./cases";

const NOW = new Date("2026-05-20T12:00:00.000Z");
const packages = discoverWidgetPackages();

describe("structure: min-count guard (anti empty-glob false-pass)", () => {
  it(`discovers at least ${KNOWN_WIDGET_MIN} widget package(s)`, () => {
    expect(packages.length).toBeGreaterThanOrEqual(KNOWN_WIDGET_MIN);
  });
});

for (const pkg of packages) {
  describe(`structure: ${pkg.name}`, () => {
    const cases = CasesSchema.parse(JSON.parse(readFileSync(join(pkg.dir, "golden", "cases.json"), "utf8")));

    it("spec validates against WidgetSpecSchema", () => {
      expect(() => WidgetSpecSchema.parse(pkg.spec)).not.toThrow();
    });

    it("verdict pipeline parses", () => {
      expect(() => parsePipeline(pkg.spec.verdict.pipeline)).not.toThrow();
    });

    it("happy output honors the template slot contract", () => {
      const happy = cases.cases.find((c) => c.name === "happy");
      if (!happy || !("given" in happy)) throw new Error("happy data case required");
      const out = execute(
        { verdict: { pipeline: parsePipeline(pkg.spec.verdict.pipeline) }, deeplink: pkg.spec.deeplink, render: pkg.spec.render },
        givenToPipelineInput(happy.given),
        buildContext(pkg.spec, NOW),
      );
      expect(() => validateSlots(pkg.spec.render.template as TemplateName, out.slots)).not.toThrow();
    });

    it("deeplink template slots all have a field mapping", () => {
      const slots = [...pkg.spec.deeplink.template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      // Non-vacuous guard: the founder spec (and every spec) must have at least one placeholder.
      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) expect(pkg.spec.deeplink.fields).toHaveProperty(s);
    });

    it("DESIGN.md rule: status is colored only when state === 'ok'", () => {
      // Fault cases must not carry a non-neutral status (failure UX shows no color).
      for (const c of cases.cases) {
        if ("fault" in c) expect(c.then.status ?? "neutral").toBe("neutral");
      }
    });

    it("includes the full required-case-set by name", () => {
      const names = cases.cases.map((c) => c.name);
      for (const required of REQUIRED_CASE_NAMES) expect(names).toContain(required);
    });
  });
}
