import { describe, expect, it } from "vitest";
import { parsePipeline, DslParseError } from "./parse";

describe("parsePipeline", () => {
  it("accepts a well-formed pipeline", () => {
    const ops = parsePipeline([
      { op: "select", from: "queries.merged" },
      { op: "reduce", as: "n", kind: "count" },
      { op: "format", template: "{n}" },
    ]);
    expect(ops).toHaveLength(3);
    expect(ops[0]).toEqual({ op: "select", from: "queries.merged" });
  });

  it("throws DslParseError on a non-array pipeline", () => {
    expect(() => parsePipeline({})).toThrow(DslParseError);
  });

  it("throws DslParseError with the op index on an unknown op", () => {
    expect(() => parsePipeline([{ op: "select", from: "q" }, { op: "teleport" }])).toThrow(/index 1/);
  });

  it("throws when a required field is missing", () => {
    expect(() => parsePipeline([{ op: "reduce", kind: "count" }])).toThrow(DslParseError);
  });
});
