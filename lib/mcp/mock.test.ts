import { describe, expect, it } from "vitest";
import { MockAdapter } from "./mock";

describe("MockAdapter", () => {
  const adapter = new MockAdapter();

  it("listMergedPRs filters by since/until window", async () => {
    const r = await adapter.listMergedPRs({
      repos: ["onkarsingh/switchboard", "onkarsingh/other-repo"],
      author: "onkarsingh",
      since: "2026-04-20T00:00:00Z",
      until: "2026-04-26T23:59:59Z",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(5);
    expect(r.data.every(p => p.mergedAt!)).toBe(true);
    for (const p of r.data) {
      expect(new Date(p.mergedAt!).getTime()).toBeGreaterThanOrEqual(new Date("2026-04-20T00:00:00Z").getTime());
      expect(new Date(p.mergedAt!).getTime()).toBeLessThanOrEqual(new Date("2026-04-26T23:59:59Z").getTime());
    }
  });

  it("listMergedPRs returns nothing outside the window", async () => {
    const r = await adapter.listMergedPRs({
      repos: ["onkarsingh/switchboard"],
      author: "onkarsingh",
      since: "2025-01-01T00:00:00Z",
      until: "2025-12-31T23:59:59Z",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(0);
  });

  it("listOpenPRs returns only fixtures without mergedAt", async () => {
    const r = await adapter.listOpenPRs({
      repos: ["onkarsingh/switchboard"],
      author: "onkarsingh",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(2);
    expect(r.data.every(p => !p.mergedAt)).toBe(true);
  });

  it("filters by repos list", async () => {
    const r = await adapter.listMergedPRs({
      repos: ["onkarsingh/other-repo"],
      author: "onkarsingh",
      since: "2026-04-13T00:00:00Z",
      until: "2026-05-10T23:59:59Z",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.every(p => p.repo === "onkarsingh/other-repo")).toBe(true);
    expect(r.data.length).toBeGreaterThan(0);
  });
});
