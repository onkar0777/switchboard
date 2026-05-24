// @vitest-environment node
import { describe, expect, it } from "vitest";
import { discoverWidgetPackages, KNOWN_WIDGET_MIN } from "./registry";

describe("discoverWidgetPackages", () => {
  it("finds every widgets/<name>/spec.json package", () => {
    const pkgs = discoverWidgetPackages();
    const names = pkgs.map((p) => p.name);
    expect(names).toContain("founder-pr-verdict");
    expect(pkgs.find((p) => p.name === "founder-pr-verdict")!.spec.id).toBe("founder-pr-verdict");
  });
  it("discovers at least the known minimum (anti empty-glob guard)", () => {
    expect(discoverWidgetPackages().length).toBeGreaterThanOrEqual(KNOWN_WIDGET_MIN);
  });
});
