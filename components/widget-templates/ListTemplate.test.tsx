import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ListTemplate } from "./ListTemplate";
import type { WidgetOutput } from "./types";

afterEach(cleanup);

const output: WidgetOutput = {
  verdict: "2 reviews waiting on you",
  value: 2,
  status: "at_risk",
  state: "ok",
  rows: [
    { id: "p1", title: "Fix flaky test", deeplink: "https://github.com/x/y/pull/1", meta: "x/y#1 · 30h" },
    { id: "p2", title: "Bump deps", deeplink: "https://github.com/x/y/pull/2", meta: "x/y#2 · 26h" },
  ],
  slots: { verdict: "2 reviews waiting on you" },
  title: "Stale reviews",
};

describe("ListTemplate", () => {
  it("renders the verdict and a deeplinked ranked row", () => {
    render(<ListTemplate output={output} />);
    expect(screen.getByText("2 reviews waiting on you").className).toContain("amber-600");
    const link = screen.getByText("Fix flaky test").closest("a");
    expect(link?.getAttribute("href")).toBe("https://github.com/x/y/pull/1");
    expect(screen.getByText(/x\/y#1 · 30h/)).toBeTruthy();
  });

  it("shows an empty affordance when there are no rows", () => {
    render(<ListTemplate output={{ ...output, rows: [], slots: { verdict: "Nothing waiting" } }} />);
    expect(screen.getByText(/Nothing to show/)).toBeTruthy();
  });

  it("does not apply status color when state !== ok", () => {
    render(<ListTemplate output={{ ...output, state: "error" }} />);
    expect(screen.getByText("2 reviews waiting on you").className).not.toContain("amber-600");
  });
});
