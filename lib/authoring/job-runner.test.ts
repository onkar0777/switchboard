// @vitest-environment node
// lib/authoring/job-runner.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobStore } from "./job-store";
import { FakeAgentRunner } from "./fake-agent-runner";
import { JobRunner } from "./job-runner";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sb-runner-")); });
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

describe("JobRunner (fake agent)", () => {
  it("AC1: clarifying question surfaces, answering reaches summary", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const agent = new FakeAgentRunner({ scripts: [[
      { type: "session", id: "s1" },
      { type: "question", toolUseId: "t1", questions: [{ question: "Which repo?", header: "Repo", options: [{ label: "sb", description: "" }], multiSelect: false }] },
      { type: "marker", text: "[[summary]]builds a PR widget[[/summary]]" },
    ]]});
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn() });
    const job = await runner.enqueue("track my PRs");

    await waitFor(async () => (await store.get(job.id))?.state === "clarifying" && Boolean((await store.get(job.id))?.pendingQuestion));
    const q = (await store.get(job.id))!.pendingQuestion!;
    await runner.answer(job.id, { [q.questions[0].question]: "sb" });

    await waitFor(async () => (await store.get(job.id))?.state === "summary");
    expect((await store.get(job.id))!.summary).toBe("builds a PR widget");
  });

  it("AC3 + AC6: Proceed → building, then landing on done", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const land = vi.fn(async () => {});
    const agent = new FakeAgentRunner({ scripts: [
      [{ type: "session", id: "s1" }, { type: "marker", text: "[[summary]]a widget[[/summary]]" }],
      [{ type: "marker", text: "[[phase:implementing]]" }, { type: "marker", text: "[[done:pr-widget]]" }],
    ]});
    const runner = new JobRunner({ store, agent, root: dir, land });
    const job = await runner.enqueue("track PRs");
    await waitFor(async () => (await store.get(job.id))?.state === "summary");
    await runner.proceed(job.id);
    await waitFor(async () => (await store.get(job.id))?.state === "done");
    expect(land).toHaveBeenCalledWith(expect.objectContaining({ widgetName: "pr-widget" }));
    expect((await store.get(job.id))!.widgetName).toBe("pr-widget");
  });

  it("AC5: a mid-build question puts the job in needs_input; answering resumes", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const agent = new FakeAgentRunner({ scripts: [
      [{ type: "session", id: "s1" }, { type: "marker", text: "[[summary]]w[[/summary]]" }],
      [{ type: "question", toolUseId: "t2", questions: [{ question: "Which field?", header: "Field", options: [{ label: "x", description: "" }], multiSelect: false }] }, { type: "marker", text: "[[done:w]]" }],
    ]});
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn(async () => {}) });
    const job = await runner.enqueue("track");
    await waitFor(async () => (await store.get(job.id))?.state === "summary");
    await runner.proceed(job.id);
    await waitFor(async () => (await store.get(job.id))?.state === "needs_input");
    const q = (await store.get(job.id))!.pendingQuestion!;
    await runner.answer(job.id, { [q.questions[0].question]: "x" });
    await waitFor(async () => (await store.get(job.id))?.state === "done");
  });

  it("AC4 (serial): a second enqueue sits in queued while the first is active", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const agent = new FakeAgentRunner({ scripts: [[{ type: "session", id: "s1" }, { type: "question", toolUseId: "t1", questions: [{ question: "Q?", header: "Q", options: [{ label: "a", description: "" }], multiSelect: false }] }]] });
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn() });
    const first = await runner.enqueue("a");
    await waitFor(async () => (await store.get(first.id))?.state === "clarifying");
    const second = await runner.enqueue("b");
    expect((await store.get(second.id))!.state).toBe("queued");
  });

  it("AC4 (no double-drive): two concurrent enqueues claim distinct slots — exactly one becomes active, the other stays queued, and neither is corrupted to failed", async () => {
    const store = new JobStore(join(dir, "jobs"));
    // A single turn-script: a clarifying question with no answer ever supplied,
    // so whichever job drives first parks in `clarifying` and never advances.
    // Only one script in the queue, so only one job can ever consume a turn.
    const agent = new FakeAgentRunner({ scripts: [[
      { type: "session", id: "s1" },
      { type: "question", toolUseId: "t1", questions: [{ question: "Which repo?", header: "Repo", options: [{ label: "sb", description: "" }], multiSelect: false }] },
    ]] });
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn() });

    // Two enqueues with NO await between them → both fire void this.pump()
    // before either has had a chance to transition anything. Pre-fix, both pumps
    // pass the (still-false) `running` guard, both read the SAME queued job, and
    // both call drive() on it; the loser's start transition throws → failSafe
    // corrupts the legitimately-running job to `failed`. Post-fix, the slot is
    // claimed synchronously so the second pump bails before driving.
    const [a, b] = await Promise.all([runner.enqueue("a"), runner.enqueue("b")]);

    // Settle: wait until one of the two has parked in `clarifying`.
    await waitFor(async () => {
      const sa = (await store.get(a.id))?.state;
      const sb = (await store.get(b.id))?.state;
      return sa === "clarifying" || sb === "clarifying";
    });

    const sa = (await store.get(a.id))!.state;
    const sb = (await store.get(b.id))!.state;
    const states = [sa, sb].sort();

    // Exactly one active (clarifying), exactly one queued — distinct slots.
    expect(states).toEqual(["clarifying", "queued"]);
    // And critically: neither was corrupted to failed by a double-drive.
    expect(sa).not.toBe("failed");
    expect(sb).not.toBe("failed");
  });

  it("AC4 (resume): a fresh runner resumes a building job from its session_id", async () => {
    const jobsDir = join(dir, "jobs");
    const store = new JobStore(jobsDir);
    // Simulate a build interrupted mid-flight: persisted as building with a session.
    const job = await store.create("track");
    await store.save({ ...job, state: "building", sessionId: "sess-X" });

    const resumed: string[] = [];
    const agent = {
      run: async (input: { resume?: string }, events: { onMarker: (m: { kind: "done"; widgetName: string }) => void }) => {
        if (input.resume) resumed.push(input.resume);
        events.onMarker({ kind: "done", widgetName: "track-widget" });
        return { endedTurn: true };
      },
    };
    const runner = new JobRunner({ store, agent: agent as never, root: dir, land: async () => {} });
    await runner.resumeInterrupted();
    // The runner re-drove the building turn with resume = the stored session id.
    await waitFor(() => resumed.includes("sess-X"));   // <-- waitFor, not a bare expect (avoids the race)
    expect(resumed).toContain("sess-X");
  });

  it("AC8: an agent error fails the job with a legible reason and writes no package", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const agent = new FakeAgentRunner({ scripts: [
      [{ type: "session", id: "s1" }, { type: "marker", text: "[[summary]]w[[/summary]]" }],
      [{ type: "error", message: "MCP server unreachable" }],
    ]});
    const land = vi.fn(async () => {});
    const runner = new JobRunner({ store, agent, root: dir, land });
    const job = await runner.enqueue("track");
    await waitFor(async () => (await store.get(job.id))?.state === "summary");
    await runner.proceed(job.id);
    await waitFor(async () => (await store.get(job.id))?.state === "failed");
    expect((await store.get(job.id))!.failureReason).toMatch(/unreachable|without a \[\[done/i);
    expect(land).not.toHaveBeenCalled();
  });
});
