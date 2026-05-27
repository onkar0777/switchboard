// @vitest-environment node
// lib/authoring/job-store.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobStore } from "./job-store";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sb-jobs-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("JobStore", () => {
  it("creates, reads back, and lists a job", async () => {
    const store = new JobStore(dir);
    const job = await store.create("track my PRs");
    expect(job.state).toBe("queued");
    expect(job.id).toMatch(/[0-9a-f-]{36}/);
    const read = await store.get(job.id);
    expect(read?.intent).toBe("track my PRs");
    expect((await store.list()).map((j) => j.id)).toContain(job.id);
  });

  it("save bumps updatedAt and persists durably (survives a fresh store instance)", async () => {
    const store = new JobStore(dir);
    const job = await store.create("x");
    await store.save({ ...job, state: "building", sessionId: "sess-1" });
    const reopened = new JobStore(dir); // simulates a backend restart
    const read = await reopened.get(job.id);
    expect(read?.state).toBe("building");
    expect(read?.sessionId).toBe("sess-1");
    expect(read).toBeDefined();
    expect(read!.updatedAt >= job.updatedAt).toBe(true);
  });

  it("findActive returns the single non-terminal, non-queued job", async () => {
    const store = new JobStore(dir);
    const a = await store.create("a");
    const b = await store.create("b");
    await store.save({ ...a, state: "building" });
    expect((await store.findActive())?.id).toBe(a.id);
    await store.save({ ...a, state: "done" });
    expect(await store.findActive()).toBeUndefined();
    expect((await store.nextQueued())?.id).toBe(b.id);
  });

  it("delete removes the job file; get then returns undefined and is idempotent", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const job = await store.create("track");
    expect(await store.get(job.id)).toBeDefined();
    await store.delete(job.id);
    expect(await store.get(job.id)).toBeUndefined();
    await store.delete(job.id); // idempotent — no throw on a missing file
  });
});
