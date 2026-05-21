import { describe, expect, it } from "vitest";
import { mapStatus, buildDeeplink, validateDeeplinkFields, DeeplinkValidationError } from "./runtime";

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

describe("buildDeeplink", () => {
  const deeplink = { template: "https://github.com/{repo}/pull/{number}", fields: { repo: "repo", number: "prNumber" } };

  it("substitutes template slots from row field paths", () => {
    const url = buildDeeplink(deeplink, { repo: "onkarsingh/switchboard", prNumber: 116 });
    expect(url).toBe("https://github.com/onkarsingh/switchboard/pull/116");
  });
});

describe("validateDeeplinkFields (save-time-style check)", () => {
  const deeplink = { template: "https://github.com/{repo}/pull/{number}", fields: { repo: "repo", number: "prNumber" } };

  it("passes when every field path resolves on the sample row", () => {
    expect(() => validateDeeplinkFields(deeplink, { repo: "a/b", prNumber: 1 })).not.toThrow();
  });

  it("throws when a mapped field path is absent from the row shape", () => {
    expect(() => validateDeeplinkFields(deeplink, { repo: "a/b" })).toThrow(DeeplinkValidationError);
  });

  it("throws when the template references a slot with no field mapping", () => {
    const bad = { template: "https://x/{repo}/{missing}", fields: { repo: "repo" } };
    expect(() => validateDeeplinkFields(bad, { repo: "a/b" })).toThrow(/missing/);
  });
});
