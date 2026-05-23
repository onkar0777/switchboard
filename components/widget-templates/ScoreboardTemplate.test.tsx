import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScoreboardTemplate } from "./ScoreboardTemplate";
import type { WidgetOutput } from "./types";

afterEach(cleanup);

const base: WidgetOutput = {
  verdict: "Velocity steady",
  value: 42,
  status: "good",
  state: "ok",
  rows: [],
  slots: { headline: "Velocity steady", value: 42, deltaPct: 12 },
  title: "Weekly velocity",
};

describe("ScoreboardTemplate", () => {
  it("renders the value, a positive delta, and colors the headline when state is ok", () => {
    render(<ScoreboardTemplate output={base} />);
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText(/12%/)).toBeTruthy();
    const headline = screen.getByText("Velocity steady");
    expect(headline.className).toContain("emerald-700");
  });

  it("does not apply status color when state !== ok", () => {
    render(<ScoreboardTemplate output={{ ...base, state: "error" }} />);
    const headline = screen.getByText("Velocity steady");
    expect(headline.className).not.toContain("emerald-700");
  });
});
