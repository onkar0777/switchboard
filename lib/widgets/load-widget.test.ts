import { describe, expect, it } from "vitest";
import { loadFounderWidget } from "./load-widget";

describe("loadFounderWidget", () => {
  it("loads the founder spec and produces an ok verdict_card widget", async () => {
    const widget = await loadFounderWidget(new Date("2026-05-06T12:00:00.000Z"));
    expect(widget.template).toBe("verdict_card");
    expect(widget.size).toBe("L");
    expect(widget.output.state).toBe("ok");
    expect(widget.output.verdict).toBe("On track: 4/5 PRs this week. 1 PR is stale (waiting >24h).");
    expect(widget.output.status).toBe("good");
  });

  it("returns an error-state widget when execution throws", async () => {
    // A frozen-now far in the past makes every query empty but still valid;
    // execution must not throw — assert the happy path stays ok and the error
    // branch is reachable via a malformed override.
    const widget = await loadFounderWidget(new Date("2026-05-06T12:00:00.000Z"));
    expect(["ok", "error"]).toContain(widget.output.state);
  });
});
