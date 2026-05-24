import { describe, expect, it } from "vitest";
import { pluralize } from "./format";

describe("pluralize (relocated from verdicts/engine)", () => {
  it("returns the singular for n === 1", () => {
    expect(pluralize(1, "PR")).toBe("PR");
  });
  it("appends 's' by default for n !== 1", () => {
    expect(pluralize(2, "PR")).toBe("PRs");
    expect(pluralize(0, "PR")).toBe("PRs");
  });
  it("uses the explicit plural when given", () => {
    expect(pluralize(2, "is", "are")).toBe("are");
  });
});
