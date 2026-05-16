import { describe, expect, it, vi } from "vitest";

describe("GET /api/verdict (mock adapter)", () => {
  it("returns the worked example verdict when SWITCHBOARD_FORCE_MOCK=1", async () => {
    vi.stubEnv("SWITCHBOARD_FORCE_MOCK", "1");
    vi.stubEnv("SWITCHBOARD_FROZEN_NOW", "2026-05-06T12:00:00Z");
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    // The default config ships only `onkarsingh/switchboard`, so the route
    // computes the verdict against the 3 PRs (W3_1..W3_3) merged in that repo
    // this week. The 4-PR worked example in the spec assumes both fixture
    // repos; the engine test covers that path directly.
    expect(body.actual).toBe(3);
    expect(body.target).toBe(5);
    expect(body.status).toBe("nearly_there");
    expect(body.headline).toBe("Halfway: 3/5 PRs this week. 1 PR is stale (waiting >24h).");
    expect(body.momentum).toEqual([2, 4, 3, 3]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns 400 when target=0", async () => {
    vi.stubEnv("SWITCHBOARD_FORCE_MOCK", "1");
    vi.stubEnv("SWITCHBOARD_TEST_TARGET_ZERO", "1");
    vi.resetModules();
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(400);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
