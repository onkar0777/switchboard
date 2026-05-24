import { describe, expect, it } from "vitest";
import { WidgetSpecSchema } from "./spec";
import { parsePipeline } from "./dsl";
import spec from "@/widgets/founder-pr-verdict/spec.json";

describe("founder-pr-verdict.spec.json", () => {
  it("validates against WidgetSpecSchema", () => {
    expect(() => WidgetSpecSchema.parse(spec)).not.toThrow();
  });

  it("has a structurally valid verdict pipeline", () => {
    const parsed = WidgetSpecSchema.parse(spec);
    expect(() => parsePipeline(parsed.verdict.pipeline)).not.toThrow();
  });

  it("declares both MCP queries (merged + open) like v1's two adapter calls", () => {
    const parsed = WidgetSpecSchema.parse(spec);
    expect(Object.keys(parsed.mcp.queries).sort()).toEqual(["merged", "open"]);
  });
});
