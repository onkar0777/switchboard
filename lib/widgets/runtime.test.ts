import { describe, expect, it } from "vitest";
import { mapStatus, buildDeeplink, validateDeeplinkFields, DeeplinkValidationError, execute } from "./runtime";
import { parsePipeline } from "./dsl";

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

describe("execute (minimal spec, no fixture)", () => {
  const ctx = { now: new Date("2026-05-06T12:00:00Z"), nowMs: Date.parse("2026-05-06T12:00:00Z"), target: 5 };
  const spec = {
    deeplink: { template: "https://github.com/{repo}/pull/{number}", fields: { repo: "repo", number: "prNumber" } },
    pipeline: parsePipeline([
      { op: "select", from: "queries.merged" },
      { op: "stash", as: "receipts" },
      { op: "reduce", as: "value", kind: "count" },
      { op: "compare", as: "statusBand", left: "{value}", right: "{target}", bands: [
        { min: 1, out: "shipped" }, { min: 0.8, out: "on_track" }, { min: 0.5, out: "nearly_there" }, { min: 0, out: "behind" },
      ] },
      { op: "format", as: "verdict", template: "{value}/{target} merged." },
    ]),
  };
  const data = { queries: { merged: [
    { id: "1", repo: "a/b", prNumber: 10 },
    { id: "2", repo: "a/b", prNumber: 11 },
  ] } };

  it("returns verdict, value, canonical status, state, and deeplinked rows", () => {
    const out = execute(
      { verdict: { pipeline: spec.pipeline }, deeplink: spec.deeplink, render: { slots: { from: "receipts" } } } as never,
      data,
      ctx as never,
    );
    expect(out.verdict).toBe("2/5 merged.");
    expect(out.value).toBe(2);
    expect(out.status).toBe("behind"); // ratio 0.4
    expect(out.state).toBe("ok");
    expect(out.rows[0].deeplink).toBe("https://github.com/a/b/pull/10");
  });
});
