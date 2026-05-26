// @vitest-environment node
// Phase 0 — recovery acceptance criteria. "Restart" = a fresh JobRunner with an
// empty in-memory handshake over the SAME on-disk store (the store re-reads
// disk). All driven by the FakeAgentRunner. Un-skipped by the phase that
// implements each AC. The existing happy-path acceptance.test.ts is the
// regression guard and stays untouched.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobStore } from "./job-store";
import { FakeAgentRunner } from "./fake-agent-runner";
import { JobRunner } from "./job-runner";
import { landPackage } from "./landing";
import { validateStagedPackage } from "./validate-package";
import type { PendingQuestion } from "./job-types";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sb-recovery-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function waitFor(pred: () => boolean | Promise<boolean>, ms = 1000): Promise<void> {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const tick = async () => {
      try {
        if (await pred()) return res();
      } catch { /* keep polling */ }
      if (Date.now() - t0 > ms) return rej(new Error("timeout"));
      setTimeout(tick, 5);
    };
    void tick();
  });
}

const aQuestion: PendingQuestion = {
  toolUseId: "t1",
  questions: [{ question: "Which repo?", header: "Repo", options: [{ label: "sb", description: "" }], multiSelect: false }],
};

// Stage the known-good founder package into .switchboard/staging/<jobId> so the
// real landPackage has something valid to publish.
function stageFounder(root: string, jobId: string): void {
  const stageDir = join(root, ".switchboard", "staging", jobId);
  mkdirSync(join(stageDir, "golden"), { recursive: true });
  const founder = join(process.cwd(), "widgets", "founder-pr-verdict");
  writeFileSync(join(stageDir, "spec.json"), readFileSync(join(founder, "spec.json"), "utf8"));
  writeFileSync(join(stageDir, "golden", "cases.json"), readFileSync(join(founder, "golden", "cases.json"), "utf8"));
}

describe("Recovery AC1 — proceed after restart (summary gate)", () => {
  it("a summary-parked job with a sessionId builds to done + landed on a fresh runner", async () => {
    const root = dir;
    const store = new JobStore(join(root, ".switchboard", "jobs"));
    const created = await store.create("track PRs");
    await store.save({ ...created, state: "summary", summary: "a widget", sessionId: "sess-A" });
    stageFounder(root, created.id);

    // Fresh runner (the "restart"): the resumed PROCEED turn emits [[done]].
    const agent = new FakeAgentRunner({ scripts: [[{ type: "marker", text: "[[done:test-widget]]" }]] });
    // Pin the validator clock to the founder fixture's PR week (see acceptance.test.ts AC6):
    // the runner validates with new Date(), but the founder golden "happy" verdict is only
    // correct when "now" is in that week. Keeps AC1 a deterministic test of the real land path.
    const runner = new JobRunner({
      store, agent, root, land: landPackage,
      validate: (dir) => validateStagedPackage(dir, new Date("2026-05-21T00:00:00.000Z")),
    });

    await runner.proceed(created.id);
    await waitFor(
      () => existsSync(join(root, "widgets", "test-widget", "spec.json")) && existsSync(join(root, "dashboard.layout.json")),
      5000,
    );
    expect((await store.get(created.id))?.state).toBe("done");
  });
});

describe("Recovery AC2 — answer after restart (clarifying)", () => {
  it("a clarifying-parked job with pendingQuestion + sessionId clears the question and reaches summary", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const created = await store.create("track PRs");
    await store.save({ ...created, state: "clarifying", sessionId: "sess-B", pendingQuestion: aQuestion });

    const agent = new FakeAgentRunner({ scripts: [[{ type: "marker", text: "[[summary]]builds a PR widget[[/summary]]" }]] });
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn(), validate: async () => ({ ok: true as const }) });

    await runner.answer(created.id, { "Which repo?": "sb" });
    await waitFor(async () => (await store.get(created.id))?.state === "summary");
    expect((await store.get(created.id))?.pendingQuestion).toBeUndefined();
    expect((await store.get(created.id))?.summary).toBe("builds a PR widget");
  });
});

describe("Recovery AC3 — answer after restart (needs_input)", () => {
  it("a needs_input-parked job with sessionId continues the build to done", async () => {
    const root = dir;
    const store = new JobStore(join(root, ".switchboard", "jobs"));
    const created = await store.create("track PRs");
    await store.save({ ...created, state: "needs_input", sessionId: "sess-C", pendingQuestion: aQuestion });

    const agent = new FakeAgentRunner({ scripts: [[{ type: "marker", text: "[[done:ni-widget]]" }]] });
    const runner = new JobRunner({ store, agent, root, land: vi.fn(async () => {}), validate: async () => ({ ok: true as const }) });

    await runner.answer(created.id, { "Which repo?": "sb" });
    await waitFor(async () => (await store.get(created.id))?.state === "done");
    expect((await store.get(created.id))?.widgetName).toBe("ni-widget");
  });
});

describe.skip("Recovery AC4 — resume failure fails legibly", () => {
  it("a job whose session cannot be resumed reaches failed with a clear reason and frees the slot", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const created = await store.create("track PRs");
    await store.save({ ...created, state: "summary", summary: "a widget", sessionId: "sess-D" });

    // Models the SDK rejecting a resumed transcript: agent.run throws.
    const agent = { run: async () => { throw new Error("SDK refused transcript"); } };
    const runner = new JobRunner({ store, agent: agent as never, root: dir, land: vi.fn(), validate: async () => ({ ok: true as const }) });

    await runner.proceed(created.id);
    await waitFor(async () => (await store.get(created.id))?.state === "failed");
    expect((await store.get(created.id))?.failureReason).toMatch(/couldn't resume session after restart/i);
    expect(await store.findActive()).toBeUndefined(); // slot freed — no retry, no restart-from-intent
  });
});

describe.skip("Recovery AC5 — queue no longer wedged", () => {
  it("a queued job starts once a parked slot-holder is resumed to a terminal state", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const a = await store.create("A");
    await store.save({ ...a, state: "summary", summary: "x", sessionId: "sA" });
    const b = await store.create("B");

    const agent = new FakeAgentRunner({ scripts: [
      [{ type: "marker", text: "[[done:a-widget]]" }],                                  // A's resumed PROCEED turn
      [{ type: "session", id: "sB" }, { type: "question", toolUseId: "tB", questions: aQuestion.questions }], // B's intake turn
    ]});
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn(async () => {}), validate: async () => ({ ok: true as const }) });

    await runner.proceed(a.id);
    await waitFor(async () => (await store.get(a.id))?.state === "done");
    await waitFor(async () => (await store.get(b.id))?.state === "clarifying"); // B left queued
  });

  // The discard-driven half of AC5 is implemented in Phase 3 (it.todo here).
  it.todo("a queued job starts once a parked slot-holder is discarded");
});

// Implemented in Phase 3 (runner.discard does not exist yet).
describe("Recovery AC6 — discard frees the slot + cleans up", () => {
  it.todo("DELETE removes the job file + staging dir and starts the queued job");
});
