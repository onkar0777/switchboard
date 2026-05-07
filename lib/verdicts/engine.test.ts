import { describe, expect, it } from "vitest";
import { pluralize, statusFor } from "./engine";

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

describe("statusFor", () => {
  it("returns 'shipped' when ratio >= 1.0", () => {
    expect(statusFor(5, 5)).toBe("shipped");
    expect(statusFor(7, 5)).toBe("shipped");
  });

  it("returns 'on_track' when 0.8 <= ratio < 1.0", () => {
    expect(statusFor(4, 5)).toBe("on_track");
    expect(statusFor(8, 10)).toBe("on_track");
  });

  it("returns 'nearly_there' when 0.5 <= ratio < 0.8", () => {
    expect(statusFor(3, 5)).toBe("nearly_there");
    expect(statusFor(5, 10)).toBe("nearly_there");
  });

  it("returns 'behind' when ratio < 0.5", () => {
    expect(statusFor(2, 5)).toBe("behind");
    expect(statusFor(0, 5)).toBe("behind");
  });
});
