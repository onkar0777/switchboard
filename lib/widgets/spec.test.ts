import { describe, expect, it } from "vitest";
import { WidgetSpecSchema } from "./spec";

const valid = {
  schemaVersion: "1.0",
  id: "founder-pr-verdict",
  title: "How am I doing against my weekly PR goal?",
  size: "L",
  params: { target: 5 },
  mcp: {
    server: "github",
    queries: {
      merged: { tool: "list_merged_prs", args: { repos: ["a/b"], author: "x" } },
    },
  },
  verdict: { kind: "deterministic", pipeline: [{ op: "select", from: "queries.merged" }] },
  deeplink: { template: "https://github.com/{repo}/pull/{number}", fields: { repo: "repo", number: "prNumber" } },
  refresh: { mode: "on_view", cacheSeconds: 3600 },
  render: { template: "verdict_card", slots: {} },
  authoredBy: { intent: "track my PRs", model: "claude-opus-4-7", timestamp: "2026-05-21T00:00:00.000Z" },
};

describe("WidgetSpecSchema", () => {
  it("parses a valid spec and defaults params to {}", () => {
    const parsed = WidgetSpecSchema.parse({ ...valid, params: undefined });
    expect(parsed.params).toEqual({});
    expect(parsed.render.template).toBe("verdict_card");
  });

  it("rejects an unknown render template", () => {
    const bad = { ...valid, render: { template: "pie_chart", slots: {} } };
    expect(() => WidgetSpecSchema.parse(bad)).toThrow();
  });

  it("rejects a missing schemaVersion", () => {
    const { schemaVersion, ...rest } = valid;
    void schemaVersion;
    expect(() => WidgetSpecSchema.parse(rest)).toThrow();
  });
});
