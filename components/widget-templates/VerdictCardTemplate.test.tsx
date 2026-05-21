import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { VerdictCardTemplate } from "./VerdictCardTemplate";

afterEach(cleanup);

const OUTPUT = {
  verdict: "On track: 4/5 PRs this week. 1 PR is stale (waiting >24h).",
  value: 4,
  status: "good" as const,
  state: "ok" as const,
  rows: [],
  momentum: [3, 5, 4, 4],
  slots: {
    verdict: "On track: 4/5 PRs this week. 1 PR is stale (waiting >24h).",
    action: "Unblock onkarsingh/switchboard#116 — stale 50h.",
    receipts: [
      { id: "W3_1", title: "Wire mock adapter end-to-end", repo: "onkarsingh/switchboard", prNumber: 112, mergedAt: "2026-05-04T16:00:00Z", deeplink: "https://github.com/onkarsingh/switchboard/pull/112" },
    ],
    drag: [
      { id: "W3_O1", title: "Refactor verdict engine internals", repo: "onkarsingh/switchboard", prNumber: 116, hoursSinceUpdate: 50, deeplink: "https://github.com/onkarsingh/switchboard/pull/116" },
    ],
    momentum: [3, 5, 4, 4],
  },
  title: "Ship 5 PRs this week",
};

describe("VerdictCardTemplate", () => {
  it("renders the verdict headline with the status color when state is ok", () => {
    render(<VerdictCardTemplate output={OUTPUT} />);
    const headline = screen.getByText(/On track: 4\/5 PRs this week/);
    expect(headline.className).toContain("emerald-700");
  });

  it("renders the Monday Move, receipts, and a deeplink", () => {
    render(<VerdictCardTemplate output={OUTPUT} />);
    expect(screen.getByText(/Unblock onkarsingh\/switchboard#116/)).toBeTruthy();
    expect(screen.getByText("Wire mock adapter end-to-end")).toBeTruthy();
    const link = screen.getByText("Wire mock adapter end-to-end").closest("a");
    expect(link?.getAttribute("href")).toBe("https://github.com/onkarsingh/switchboard/pull/112");
  });
});
