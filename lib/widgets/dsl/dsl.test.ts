import { describe, expect, it } from "vitest";
import { parsePipeline, DslParseError } from "./parse";
import { evaluate, DslEvalError } from "./evaluate";

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

const ROWS = [
  { id: "a", n: 3, when: "2026-05-04T10:00:00Z" },
  { id: "b", n: 1, when: "2026-05-06T10:00:00Z" },
  { id: "c", n: 2, when: "2026-05-05T10:00:00Z" },
];
const CTX = { now: new Date("2026-05-06T12:00:00Z"), nowMs: Date.parse("2026-05-06T12:00:00Z") };

function run(pipeline: unknown[], queries: Record<string, unknown> = {}) {
  return evaluate(parsePipeline(pipeline), { queries }, CTX as never);
}

describe("evaluate — collection ops", () => {
  it("select + stash exposes a query under a bag name", () => {
    const bag = run([
      { op: "select", from: "queries.rows" },
      { op: "stash", as: "all" },
    ], { rows: ROWS });
    expect(bag.all).toEqual(ROWS);
  });

  it("filter keeps matching rows, preserving order", () => {
    const bag = run([
      { op: "select", from: "queries.rows" },
      { op: "filter", where: { gte: ["n", 2] } },
      { op: "stash", as: "kept" },
    ], { rows: ROWS });
    expect((bag.kept as { id: string }[]).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("filter on an empty collection returns []", () => {
    const bag = run([
      { op: "select", from: "queries.rows" },
      { op: "filter", where: { gt: ["n", 0] } },
      { op: "stash", as: "kept" },
    ], { rows: [] });
    expect(bag.kept).toEqual([]);
  });

  it("sort desc then first picks the max", () => {
    const bag = run([
      { op: "select", from: "queries.rows" },
      { op: "sort", by: "n", dir: "desc" },
      { op: "first" },
      { op: "stash", as: "top" },
    ], { rows: ROWS });
    expect((bag.top as { id: string }).id).toBe("a");
  });

  it("first on an empty collection yields null", () => {
    const bag = run([
      { op: "select", from: "queries.rows" },
      { op: "first" },
      { op: "stash", as: "top" },
    ], { rows: [] });
    expect(bag.top).toBeNull();
  });

  it("map projects fields", () => {
    const bag = run([
      { op: "select", from: "queries.rows" },
      { op: "map", fields: { key: "id", twice: { lit: 2 } } },
      { op: "stash", as: "m" },
    ], { rows: ROWS });
    expect(bag.m).toEqual([
      { key: "a", twice: 2 },
      { key: "b", twice: 2 },
      { key: "c", twice: 2 },
    ]);
  });

  it("throws DslEvalError selecting a missing query", () => {
    expect(() => run([{ op: "select", from: "queries.nope" }], { rows: ROWS })).toThrow(DslEvalError);
  });
});
