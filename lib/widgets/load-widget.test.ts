import { describe, expect, it, vi } from "vitest";

describe("loadFounderWidget", () => {
  it("loads the founder spec and produces an ok verdict_card widget", async () => {
    const { loadFounderWidget } = await import("./load-widget");
    const widget = await loadFounderWidget(new Date("2026-05-06T12:00:00.000Z"));
    expect(widget.template).toBe("verdict_card");
    expect(widget.size).toBe("L");
    expect(widget.output.state).toBe("ok");
    expect(widget.output.verdict).toBe("On track: 4/5 PRs this week. 1 PR is stale (waiting >24h).");
    expect(widget.output.status).toBe("good");
  });

  it("returns an error-state widget when execution throws", async () => {
    vi.resetModules();
    vi.doMock("./fixture-data", () => ({
      buildFixtureData: () => { throw new Error("boom: MCP unreachable"); },
    }));
    const { loadFounderWidget: load } = await import("./load-widget");
    const widget = await load(new Date("2026-05-06T12:00:00.000Z"));
    expect(widget.output.state).toBe("error");
    expect(widget.errorMessage).toContain("boom");
    vi.doUnmock("./fixture-data");
    vi.resetModules();
  });
});
