// @vitest-environment node
// lib/authoring/landing.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { landPackage } from "./landing";

let root: string; // a fake repo root with widgets/ + dashboard.layout.json
let stage: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sb-root-"));
  mkdirSync(join(root, "widgets"), { recursive: true });
  stage = mkdtempSync(join(tmpdir(), "sb-stage-"));
  mkdirSync(join(stage, "golden"), { recursive: true });
  writeFileSync(join(stage, "spec.json"), '{"id":"pr-widget"}');
  writeFileSync(join(stage, "golden", "cases.json"), '{"cases":[]}');
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); rmSync(stage, { recursive: true, force: true }); });

describe("landPackage", () => {
  it("moves the staged package to widgets/<name> and appends the id to the layout", async () => {
    await landPackage({ root, stageDir: stage, widgetName: "pr-widget" });
    expect(existsSync(join(root, "widgets", "pr-widget", "spec.json"))).toBe(true);
    expect(existsSync(join(root, "widgets", "pr-widget", "golden", "cases.json"))).toBe(true);
    const layout = JSON.parse(readFileSync(join(root, "dashboard.layout.json"), "utf8"));
    expect(layout.widgets).toEqual(["pr-widget"]);
  });

  it("refuses to overwrite an existing widget directory (no clobber)", async () => {
    mkdirSync(join(root, "widgets", "pr-widget"), { recursive: true });
    await expect(landPackage({ root, stageDir: stage, widgetName: "pr-widget" })).rejects.toThrow(/already exists/i);
    // layout untouched
    expect(existsSync(join(root, "dashboard.layout.json"))).toBe(false);
  });
});
