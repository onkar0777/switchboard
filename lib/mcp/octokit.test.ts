import { describe, expect, it } from "vitest";
import { mapSearchItemToReceipt, buildSearchQuery } from "./octokit";

describe("buildSearchQuery", () => {
  it("composes a single search query for multiple repos (merged)", () => {
    const q = buildSearchQuery({
      repos: ["x/y", "a/b"],
      author: "me",
      kind: "merged",
      since: "2026-04-13T00:00:00Z",
      until: "2026-05-10T23:59:59Z",
    });
    expect(q).toBe("is:pr is:merged author:me repo:x/y repo:a/b merged:2026-04-13..2026-05-10");
  });

  it("composes a query for open PRs (no date range)", () => {
    const q = buildSearchQuery({
      repos: ["x/y"],
      author: "me",
      kind: "open",
    });
    expect(q).toBe("is:pr is:open author:me repo:x/y");
  });
});

describe("mapSearchItemToReceipt", () => {
  it("maps a merged search item with hoursSinceUpdate=0 and mergedAt", () => {
    const item: any = {
      node_id: "PR_kw1",
      number: 42,
      title: "Add thing",
      html_url: "https://github.com/x/y/pull/42",
      repository_url: "https://api.github.com/repos/x/y",
      created_at: "2026-05-04T08:00:00Z",
      updated_at: "2026-05-04T16:00:00Z",
      pull_request: { merged_at: "2026-05-04T16:00:00Z" },
    };
    const now = new Date("2026-05-06T12:00:00Z");
    const r = mapSearchItemToReceipt(item, now);
    expect(r.id).toBe("PR_kw1");
    expect(r.prNumber).toBe(42);
    expect(r.title).toBe("Add thing");
    expect(r.repo).toBe("x/y");
    expect(r.url).toBe("https://github.com/x/y/pull/42");
    expect(r.openedAt).toBe("2026-05-04T08:00:00Z");
    expect(r.mergedAt).toBe("2026-05-04T16:00:00Z");
    expect(r.hoursSinceUpdate).toBeCloseTo(44, 0);
  });

  it("maps an open search item without mergedAt", () => {
    const item: any = {
      node_id: "PR_kw2",
      number: 43,
      title: "WIP",
      html_url: "https://github.com/x/y/pull/43",
      repository_url: "https://api.github.com/repos/x/y",
      created_at: "2026-05-05T08:00:00Z",
      updated_at: "2026-05-05T08:00:00Z",
      pull_request: {},
    };
    const now = new Date("2026-05-06T12:00:00Z");
    const r = mapSearchItemToReceipt(item, now);
    expect(r.mergedAt).toBeUndefined();
    expect(r.hoursSinceUpdate).toBeCloseTo(28, 0);
  });
});
