import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SummaryMarkdown } from "./SummaryMarkdown";

afterEach(cleanup);

describe("SummaryMarkdown", () => {
  it("renders markdown emphasis as elements, not literal syntax", () => {
    render(<SummaryMarkdown text="Tracks **open PRs** from the `github` server." />);
    // The bold text is a <strong>, and the raw asterisks are gone.
    expect(screen.getByText("open PRs").tagName).toBe("STRONG");
    expect(screen.getByText("github").tagName).toBe("CODE");
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it("renders a markdown list as list items", () => {
    render(<SummaryMarkdown text={"Status rule:\n\n- good if >= 5\n- behind if < 3"} />);
    expect(screen.getByText("good if >= 5").closest("li")).not.toBeNull();
    expect(screen.getByText("behind if < 3").closest("li")).not.toBeNull();
  });
});
