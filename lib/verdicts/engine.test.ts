import { describe, expect, it } from "vitest";
import { pluralize } from "./engine";

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
