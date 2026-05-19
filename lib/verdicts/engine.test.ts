import { describe, expect, it } from "vitest";
import { pluralize, statusFor, headlineFor, pickMondayMove, mondayOfWeek, sundayEndOfWeek, bucketMomentum, computeVerdict } from "./engine";
import type { GoalConfig, Receipt } from "./types";
import { MockAdapter } from "@/lib/mcp/mock";

describe("pluralize", () => {
  it("returns singular when n === 1", () => {
    expect(pluralize(1, "PR")).toBe("PR");
    expect(pluralize(1, "is", "are")).toBe("is");
  });

  it("returns default plural (s-suffix) when n !== 1", () => {
    expect(pluralize(0, "PR")).toBe("PRs");
    expect(pluralize(2, "PR")).toBe("PRs");
    expect(pluralize(5, "PR")).toBe("PRs");
  });

  it("returns explicit plural form when provided", () => {
    expect(pluralize(0, "is", "are")).toBe("are");
    expect(pluralize(2, "is", "are")).toBe("are");
  });
});

describe("statusFor", () => {
  it("returns 'shipped' when ratio >= 1.0", () => {
    expect(statusFor(5, 5)).toBe("shipped");
    expect(statusFor(7, 5)).toBe("shipped");
  });

  it("returns 'on_track' when 0.8 <= ratio < 1.0", () => {
    expect(statusFor(4, 5)).toBe("on_track");
    expect(statusFor(8, 10)).toBe("on_track");
  });

  it("returns 'nearly_there' when 0.5 <= ratio < 0.8", () => {
    expect(statusFor(3, 5)).toBe("nearly_there");
    expect(statusFor(5, 10)).toBe("nearly_there");
  });

  it("returns 'behind' when ratio < 0.5", () => {
    expect(statusFor(2, 5)).toBe("behind");
    expect(statusFor(0, 5)).toBe("behind");
  });
});

const goal: GoalConfig = {
  kind: "github_prs_merged",
  label: "Ship 5 PRs this week",
  target: 5,
  unit: "PR",
  repos: ["x/y"],
  author: "x",
};

describe("headlineFor", () => {
  it("formats 'shipped' with pluralized unit", () => {
    expect(headlineFor("shipped", goal, 5, 0)).toBe("Shipped: 5/5 PRs this week.");
  });

  it("formats 'on_track' (4/5)", () => {
    expect(headlineFor("on_track", goal, 4, 0)).toBe("On track: 4/5 PRs this week.");
  });

  it("formats 'nearly_there' as 'Halfway' (renamed in spec)", () => {
    expect(headlineFor("nearly_there", goal, 3, 0)).toBe("Halfway: 3/5 PRs this week.");
  });

  it("formats 'behind' (1/5)", () => {
    expect(headlineFor("behind", goal, 1, 0)).toBe("Behind: 1/5 PRs this week.");
  });

  it("uses singular unit for actual=1", () => {
    expect(headlineFor("behind", goal, 1, 0)).toContain("1/5 PRs");
    const singleTargetGoal = { ...goal, target: 1 };
    expect(headlineFor("on_track", singleTargetGoal, 1, 0)).toBe("On track: 1/1 PR this week.");
  });

  it("appends drag sentence with singular 'is' when drag count = 1", () => {
    expect(headlineFor("on_track", goal, 4, 1)).toBe("On track: 4/5 PRs this week. 1 PR is stale (waiting >24h).");
  });

  it("appends drag sentence with plural 'are' when drag count > 1", () => {
    expect(headlineFor("behind", goal, 1, 3)).toBe("Behind: 1/5 PRs this week. 3 PRs are stale (waiting >24h).");
  });

  it("does not append drag sentence when drag count = 0", () => {
    expect(headlineFor("shipped", goal, 5, 0)).toBe("Shipped: 5/5 PRs this week.");
  });

  it("appends warm zero-state sentence when actual=0, no drag, no open PRs", () => {
    expect(headlineFor("behind", goal, 0, 0, 0)).toBe(
      "Behind: 0/5 PRs this week. Nothing merged yet — the week is yours.",
    );
  });

  it("omits zero-state sentence when open PRs exist (Monday Move covers it)", () => {
    expect(headlineFor("behind", goal, 0, 0, 2)).toBe("Behind: 0/5 PRs this week.");
  });

  it("drag sentence takes precedence over zero-state sentence at actual=0", () => {
    expect(headlineFor("behind", goal, 0, 1, 0)).toBe(
      "Behind: 0/5 PRs this week. 1 PR is stale (waiting >24h).",
    );
  });
});

function open(props: Partial<Receipt> & { id: string; prNumber: number }): Receipt {
  return {
    id: props.id,
    prNumber: props.prNumber,
    repo: props.repo ?? "owner/repo",
    title: props.title ?? "test",
    url: props.url ?? "https://example.test",
    openedAt: props.openedAt ?? "2026-05-01T00:00:00Z",
    hoursSinceUpdate: props.hoursSinceUpdate,
  };
}

describe("pickMondayMove", () => {
  const NOW = new Date("2026-05-06T12:00:00Z");

  it("returns null when no drag and no open PRs", () => {
    expect(pickMondayMove([], [], NOW)).toBeNull();
  });

  it("when drag exists, picks the stalest", () => {
    const drag = [
      open({ id: "a", prNumber: 10, repo: "x/y", hoursSinceUpdate: 30 }),
      open({ id: "b", prNumber: 11, repo: "x/y", hoursSinceUpdate: 50 }),
      open({ id: "c", prNumber: 12, repo: "x/y", hoursSinceUpdate: 25 }),
    ];
    expect(pickMondayMove(drag, drag, NOW)).toBe("Unblock x/y#11 — stale 50h.");
  });

  it("when no drag but open PRs exist, picks most recently opened", () => {
    const now = new Date("2026-05-05T20:00:00Z");
    const open1 = open({ id: "a", prNumber: 10, repo: "x/y", openedAt: "2026-05-01T08:00:00Z", hoursSinceUpdate: 4 });
    const open2 = open({ id: "b", prNumber: 11, repo: "x/y", openedAt: "2026-05-05T18:00:00Z", hoursSinceUpdate: 2 });
    const open3 = open({ id: "c", prNumber: 12, repo: "x/y", openedAt: "2026-05-04T12:00:00Z", hoursSinceUpdate: 6 });
    expect(pickMondayMove([], [open1, open2, open3], now)).toBe("Push x/y#11 — 2h since you opened it.");
  });

  it("rounds hours-since-opened to a whole number for the open-PR move", () => {
    const now = new Date("2026-05-05T06:42:00Z");
    const o = open({ id: "a", prNumber: 10, repo: "x/y", openedAt: "2026-05-05T00:00:00Z", hoursSinceUpdate: 0 });
    expect(pickMondayMove([], [o], now)).toBe("Push x/y#10 — 7h since you opened it.");
  });

  it("reports hours since opened, not since last update, for the open-PR move", () => {
    // PR opened 5 days ago but updated 2h ago — message must reflect open age, not update age.
    const now = new Date("2026-05-06T12:00:00Z");
    const o = open({ id: "a", prNumber: 10, repo: "x/y", openedAt: "2026-05-01T12:00:00Z", hoursSinceUpdate: 2 });
    expect(pickMondayMove([], [o], now)).toBe("Push x/y#10 — 120h since you opened it.");
  });
});

describe("mondayOfWeek", () => {
  it("returns Monday for a Wednesday (UTC)", () => {
    const wed = new Date("2026-05-06T12:34:56Z");
    expect(mondayOfWeek(wed).toISOString()).toBe("2026-05-04T00:00:00.000Z");
  });

  it("returns same Monday for a Monday", () => {
    const mon = new Date("2026-05-04T08:00:00Z");
    expect(mondayOfWeek(mon).toISOString()).toBe("2026-05-04T00:00:00.000Z");
  });

  it("returns the prior Monday for a Sunday", () => {
    const sun = new Date("2026-05-10T20:00:00Z");
    expect(mondayOfWeek(sun).toISOString()).toBe("2026-05-04T00:00:00.000Z");
  });
});

describe("sundayEndOfWeek", () => {
  it("returns Sunday 23:59:59.999 for a Wednesday", () => {
    const wed = new Date("2026-05-06T12:34:56Z");
    expect(sundayEndOfWeek(wed).toISOString()).toBe("2026-05-10T23:59:59.999Z");
  });
});

describe("bucketMomentum", () => {
  it("buckets 4 weeks of merged PRs (oldest -> current) using mock fixtures", async () => {
    const { MOCK_PRS } = await import("@/lib/mcp/fixtures");
    const merged = MOCK_PRS.filter(p => p.mergedAt);
    const now = new Date("2026-05-06T12:00:00Z");
    expect(bucketMomentum(merged, now)).toEqual([3, 5, 4, 4]);
  });

  it("returns four zeros when no PRs", () => {
    expect(bucketMomentum([], new Date("2026-05-06T12:00:00Z"))).toEqual([0, 0, 0, 0]);
  });

  it("ignores PRs older than 4 weeks ago", async () => {
    const { MOCK_PRS } = await import("@/lib/mcp/fixtures");
    const now = new Date("2026-05-06T12:00:00Z");
    const monday = mondayOfWeek(now);
    const fourWeeksAgo = new Date(monday);
    fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 21);
    const ancient = { ...MOCK_PRS[0], id: "ancient", mergedAt: "2024-01-01T00:00:00Z" };
    const result = bucketMomentum([ancient, ...MOCK_PRS.filter(p => p.mergedAt)], now);
    expect(result).toEqual([3, 5, 4, 4]);
    void fourWeeksAgo;
  });
});

describe("computeVerdict (mock adapter, fixed now)", () => {
  const adapter = new MockAdapter();
  const goal: GoalConfig = {
    kind: "github_prs_merged",
    label: "Ship 5 PRs this week",
    target: 5,
    unit: "PR",
    repos: ["onkarsingh/switchboard", "onkarsingh/other-repo"],
    author: "onkarsingh",
  };
  const now = new Date("2026-05-06T12:00:00Z");

  it("computes the worked-example verdict from the spec", async () => {
    const r = await computeVerdict(adapter, goal, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = r.data;
    expect(v.actual).toBe(4);
    expect(v.target).toBe(5);
    expect(v.status).toBe("on_track");
    expect(v.headline).toBe("On track: 4/5 PRs this week. 1 PR is stale (waiting >24h).");
    expect(v.receipts.map(r => r.id).sort()).toEqual(["W3_1", "W3_2", "W3_3", "W3_4"]);
    expect(v.drag.map(r => r.id)).toEqual(["W3_O1"]);
    expect(v.momentum).toEqual([3, 5, 4, 4]);
    expect(v.mondayMove).toBe("Unblock onkarsingh/switchboard#116 — stale 50h.");
  });

  it("returns adapter error transparently", async () => {
    const broken = {
      async listMergedPRs() {
        return { ok: false as const, error: { code: "auth_failed" as const, message: "bad token" } };
      },
      async listOpenPRs() {
        return { ok: true as const, data: [] };
      },
    };
    const r = await computeVerdict(broken, goal, now);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("auth_failed");
  });
});
