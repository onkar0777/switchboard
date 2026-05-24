// @vitest-environment node
// lib/authoring/validate-package.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateStagedPackage } from "./validate-package";

// Reuse the real founder package as a known-good fixture for the staged shape.
const FOUNDER_DIR = join(process.cwd(), "widgets", "founder-pr-verdict");

let stage: string;
beforeEach(() => {
  stage = mkdtempSync(join(tmpdir(), "sb-stage-"));
  mkdirSync(join(stage, "golden"), { recursive: true });
  writeFileSync(join(stage, "spec.json"), readFileSync(join(FOUNDER_DIR, "spec.json"), "utf8"));
  writeFileSync(join(stage, "golden", "cases.json"), readFileSync(join(FOUNDER_DIR, "golden", "cases.json"), "utf8"));
});
afterEach(() => rmSync(stage, { recursive: true, force: true }));

describe("validateStagedPackage", () => {
  it("accepts a well-formed package (founder shape) and reports its name + spec id", async () => {
    const res = await validateStagedPackage(stage, new Date("2026-05-20T12:00:00.000Z"));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.spec.id).toBe("founder-pr-verdict");
  });

  it("rejects a package whose golden case `then` does not match execution", async () => {
    const cases = JSON.parse(readFileSync(join(stage, "golden", "cases.json"), "utf8"));
    const happy = cases.cases.find((c: { name: string }) => c.name === "happy");
    happy.then.verdict = "WRONG VERDICT";
    writeFileSync(join(stage, "golden", "cases.json"), JSON.stringify(cases));
    const res = await validateStagedPackage(stage, new Date("2026-05-20T12:00:00.000Z"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/golden/i);
  });

  it("rejects a package missing a required case", async () => {
    const cases = JSON.parse(readFileSync(join(stage, "golden", "cases.json"), "utf8"));
    cases.cases = cases.cases.filter((c: { name: string }) => c.name !== "unauthorized");
    writeFileSync(join(stage, "golden", "cases.json"), JSON.stringify(cases));
    const res = await validateStagedPackage(stage, new Date("2026-05-20T12:00:00.000Z"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/required case/i);
  });
});
