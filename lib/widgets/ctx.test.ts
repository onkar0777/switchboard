import { describe, expect, it } from "vitest";
import { buildContext } from "./ctx";
import { buildFixtureData } from "./fixture-data";
import { WidgetSpecSchema } from "./spec";
import founderSpecJson from "@/widgets/founder-pr-verdict/spec.json";

const NOW = new Date("2026-05-06T12:00:00.000Z");

describe("buildContext", () => {
  it("derives week anchors from now and merges spec params", () => {
    const spec = WidgetSpecSchema.parse(founderSpecJson);
    const ctx = buildContext(spec, NOW);
    expect(ctx.weekStartIso).toBe("2026-05-04T00:00:00.000Z");
    expect(ctx.weekEndIso).toBe("2026-05-10T23:59:59.999Z");
    expect(ctx.fourWeeksAgoIso).toBe("2026-04-13T00:00:00.000Z");
    expect(ctx.nowMs).toBe(NOW.getTime());
    expect(ctx.target).toBe(5);
  });
});

describe("buildFixtureData", () => {
  it("returns merged (4wk) and open query results from MOCK_PRS", async () => {
    const spec = WidgetSpecSchema.parse(founderSpecJson);
    const ctx = buildContext(spec, NOW);
    const data = await buildFixtureData(spec, ctx);
    const merged = data.queries.merged as { id: string }[];
    const open = data.queries.open as { id: string }[];
    expect(merged).toHaveLength(16); // W0..W3 merged
    expect(open.map((p) => p.id).sort()).toEqual(["W3_O1", "W3_O2"]);
  });
});
