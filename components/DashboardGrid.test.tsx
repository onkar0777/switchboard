import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DashboardGrid, type GridWidget } from "./DashboardGrid";

afterEach(cleanup);

const okWidget: GridWidget = {
  id: "founder-pr-verdict",
  title: "Ship 5 PRs this week",
  size: "L",
  template: "verdict_card",
  output: {
    verdict: "On track: 4/5 PRs this week.",
    value: 4, status: "good", state: "ok", rows: [], momentum: [3, 5, 4, 4],
    slots: { verdict: "On track: 4/5 PRs this week.", receipts: [], drag: [], momentum: [3, 5, 4, 4], action: null },
  },
};

const errorWidget: GridWidget = {
  id: "broken",
  title: "Stale reviews",
  size: "M",
  template: "verdict_card",
  output: { verdict: "", value: null, status: "neutral", state: "error", rows: [], slots: {} },
  errorMessage: "Can't reach the github MCP server.",
};

describe("DashboardGrid", () => {
  it("renders widgets in authored order", () => {
    render(<DashboardGrid widgets={[okWidget, errorWidget]} />);
    const headings = screen.getAllByRole("article");
    expect(headings).toHaveLength(2);
  });

  it("renders the failure-state UX (not the verdict color) when state !== ok", () => {
    render(<DashboardGrid widgets={[errorWidget]} />);
    expect(screen.getByText(/Can't reach the github MCP server/)).toBeTruthy();
  });

  it("applies the L size span class", () => {
    const { container } = render(<DashboardGrid widgets={[okWidget]} />);
    expect(container.querySelector(".col-span-4")).toBeTruthy();
  });
});
