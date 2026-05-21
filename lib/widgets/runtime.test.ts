import { describe, expect, it } from "vitest";
import { mapStatus } from "./runtime";

describe("mapStatus (Decision 1 table)", () => {
  it("maps v1 bands to canonical status", () => {
    expect(mapStatus("shipped")).toBe("good");
    expect(mapStatus("on_track")).toBe("good");
    expect(mapStatus("nearly_there")).toBe("at_risk");
    expect(mapStatus("behind")).toBe("behind");
  });

  it("falls back to neutral for any unmapped band label", () => {
    expect(mapStatus("passing")).toBe("neutral");
    expect(mapStatus(undefined)).toBe("neutral");
  });
});
