import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SingleStatTemplate } from "./SingleStatTemplate";
import type { WidgetOutput } from "./types";

afterEach(cleanup);

const output: WidgetOutput = {
  verdict: "3 incidents this week — above baseline.",
  value: 3,
  status: "behind",
  state: "ok",
  rows: [],
  slots: { value: 3, label: "Incidents", verdict: "3 incidents this week — above baseline." },
  title: "Incidents",
};

describe("SingleStatTemplate", () => {
  it("renders the big number, the label, and the status-colored verdict", () => {
    render(<SingleStatTemplate output={output} />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Incidents")).toBeTruthy();
    expect(screen.getByText(/above baseline/).className).toContain("rose-700");
  });

  it("falls back to muted verdict color when state !== ok", () => {
    render(<SingleStatTemplate output={{ ...output, state: "empty" }} />);
    expect(screen.getByText(/above baseline/).className).not.toContain("rose-700");
  });
});
