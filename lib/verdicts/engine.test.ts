import { describe, expect, it } from "vitest";
import { pluralize, statusFor, headlineFor } from "./engine";
import type { GoalConfig } from "./types";

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
});
