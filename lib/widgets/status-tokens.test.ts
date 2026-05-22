import { describe, expect, it } from "vitest";
import { STATUS_TEXT, STATUS_RULE } from "./status-tokens";

describe("status color tokens (DESIGN.md)", () => {
  it("maps each canonical status to a text color class", () => {
    expect(STATUS_TEXT.good).toContain("emerald-700");
    expect(STATUS_TEXT.at_risk).toContain("amber-600");
    expect(STATUS_TEXT.behind).toContain("rose-700");
    expect(STATUS_TEXT.neutral).toContain("stone-900");
  });

  it("provides a matching top-rule color per status", () => {
    expect(STATUS_RULE.good).toContain("emerald-700");
    expect(STATUS_RULE.neutral).toContain("stone-200");
  });
});
