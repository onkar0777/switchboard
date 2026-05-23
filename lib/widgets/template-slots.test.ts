import { describe, expect, it } from "vitest";
import { validateSlots, SlotValidationError } from "./template-slots";

describe("validateSlots", () => {
  it("accepts the founder verdict_card resolved slots", () => {
    expect(() =>
      validateSlots("verdict_card", {
        verdict: "On track: 4/5 PRs this week.",
        receipts: [{ id: "W3_1", title: "Wire mock adapter", repo: "x/y", prNumber: 1 }],
        drag: [],
        momentum: [3, 5, 4, 4],
        action: "Unblock x/y#1 — stale 50h.",
      }),
    ).not.toThrow();
  });

  it("accepts a single_stat slot set", () => {
    expect(() => validateSlots("single_stat", { value: 7, label: "Open PRs", verdict: "7 open." })).not.toThrow();
  });

  it("rejects a list slot set with no verdict string", () => {
    expect(() => validateSlots("list", { rows: [] })).toThrow(SlotValidationError);
  });

  it("accepts a single_stat slot set relying on the value/label fallbacks", () => {
    // SingleStatTemplate falls back to output.value / output.title when these
    // slots are absent (plan D4) — validateSlots must not reject the shape.
    expect(() => validateSlots("single_stat", {})).not.toThrow();
    expect(() => validateSlots("single_stat", { value: 7 })).not.toThrow();
  });

  it("rejects a single_stat slot with a wrong-typed value", () => {
    expect(() => validateSlots("single_stat", { value: { nope: true } })).toThrow(SlotValidationError);
  });
});
