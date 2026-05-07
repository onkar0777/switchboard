import { describe, expect, it, vi } from "vitest";

describe("GET /api/verdict (mock adapter)", () => {
  it("returns the worked example verdict when SWITCHBOARD_FORCE_MOCK=1", async () => {
    vi.stubEnv("SWITCHBOARD_FORCE_MOCK", "1");
    vi.stubEnv("SWITCHBOARD_FROZEN_NOW", "2026-05-06T12:00:00Z");
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actual).toBe(4);
    expect(body.target).toBe(5);
    expect(body.status).toBe("on_track");
    expect(body.headline).toBe("On track: 4/5 PRs this week. 1 PR is stale (waiting >24h).");
    expect(body.momentum).toEqual([3, 5, 4, 4]);
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
