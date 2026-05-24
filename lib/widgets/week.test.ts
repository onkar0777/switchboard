import { describe, expect, it } from "vitest";
import { mondayOfWeek, sundayEndOfWeek } from "./week";

describe("week math (relocated from verdicts/engine)", () => {
  it("mondayOfWeek returns the UTC Monday 00:00 of the given date's week", () => {
    // 2026-05-20 is a Wednesday; its Monday is 2026-05-18.
    expect(mondayOfWeek(new Date("2026-05-20T12:00:00.000Z")).toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });
  it("sundayEndOfWeek returns the UTC Sunday 23:59:59.999 of that week", () => {
    expect(sundayEndOfWeek(new Date("2026-05-20T12:00:00.000Z")).toISOString()).toBe("2026-05-24T23:59:59.999Z");
  });
});
