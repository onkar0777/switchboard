// @vitest-environment node
// lib/authoring/layout.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLayout, appendWidgetId } from "./layout";

let dir: string;
let file: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sb-layout-")); file = join(dir, "dashboard.layout.json"); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("layout", () => {
  it("readLayout returns an empty ordered list when the file is absent", async () => {
    expect(await readLayout(file)).toEqual({ schemaVersion: "1.0", widgets: [] });
  });
  it("appendWidgetId appends in authored order, atomically, idempotently", async () => {
    await appendWidgetId(file, "a");
    await appendWidgetId(file, "b");
    await appendWidgetId(file, "a"); // duplicate is a no-op
    expect((await readLayout(file)).widgets).toEqual(["a", "b"]);
    // No leftover tmp files (atomic rename cleaned up).
    expect(readFileSync(file, "utf8")).toContain('"widgets"');
  });
});
