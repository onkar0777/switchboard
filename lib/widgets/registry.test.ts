// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

  it("uses a custom root and ignores loose root-level *.spec.json files", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "registry-test-"));
    try {
      // Create a valid package: alpha/spec.json
      // Copy the real founder-pr-verdict spec (guaranteed schema-valid), adjust id.
      const alphaDir = join(tmpDir, "alpha");
      mkdirSync(alphaDir);
      const sourceSpecPath = join(__dirname, "../../widgets/founder-pr-verdict/spec.json");
      const sourceSpec = JSON.parse(readFileSync(sourceSpecPath, "utf8"));
      const alphaSpec = { ...sourceSpec, id: "alpha" };
      writeFileSync(join(alphaDir, "spec.json"), JSON.stringify(alphaSpec));

      // Create a loose root-level *.spec.json — should be ignored
      writeFileSync(join(tmpDir, "loose.spec.json"), JSON.stringify(alphaSpec));

      const pkgs = discoverWidgetPackages(tmpDir);
      expect(pkgs).toHaveLength(1);
      expect(pkgs[0].name).toBe("alpha");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
