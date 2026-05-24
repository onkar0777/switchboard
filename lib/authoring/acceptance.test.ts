// @vitest-environment node
// Phase 0 — acceptance criteria for the widget authoring flow. Each is skipped
// and un-skipped by the phase that implements it. Boundaries: job-runner
// observable state, the emitted package, dashboard.layout.json, the SSE/question
// bridge. All driven by the FakeAgentRunner — no network, no real agent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobStore } from "./job-store";
import { FakeAgentRunner } from "./fake-agent-runner";
import { JobRunner } from "./job-runner";
import type { JobState } from "./job-types";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sb-ac-")); });
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

// The complete, ATDD-stable set of states. No plan-approval or test-approval
// state exists — feedback re-summarizes, it never gates on a plan.
const JOB_STATES: JobState[] = [
  "queued", "clarifying", "summary", "building", "needs_input", "done", "failed",
];

describe("AC1 — intent → questions → summary", () => {
  it("clarifying questions surface in-app one at a time; answering reaches a build summary with Proceed/Feedback", async () => {
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
    expect(q.questions).toHaveLength(1); // one at a time
    await runner.answer(job.id, { [q.questions[0].question]: "sb" });

    await waitFor(async () => (await store.get(job.id))?.state === "summary");
    expect((await store.get(job.id))!.summary).toBe("builds a PR widget");
  });
});

describe("AC2 — feedback loop", () => {
  it("Give feedback returns to clarifying and re-summarizes; no plan/test approval is ever shown", async () => {
    const store = new JobStore(join(dir, "jobs"));
    // Turn 1: first summary. Turn 2 (after feedback): a re-summary.
    const agent = new FakeAgentRunner({ scripts: [
      [{ type: "session", id: "s1" }, { type: "marker", text: "[[summary]]tracks my PRs[[/summary]]" }],
      [{ type: "marker", text: "[[summary]]tracks my issues instead[[/summary]]" }],
    ]});
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn() });

    // Observe every state the job ever takes; assert it stays within the union.
    const seen: JobState[] = [];
    const record = async () => {
      const s = (await store.get(job.id))?.state;
      if (s && seen[seen.length - 1] !== s) seen.push(s);
    };

    const job = await runner.enqueue("track my PRs");
    await waitFor(async () => { await record(); return (await store.get(job.id))?.state === "summary"; });
    expect((await store.get(job.id))!.summary).toBe("tracks my PRs");

    // Feedback → returns to clarifying, then re-summarizes.
    await runner.feedback(job.id, "actually track issues");
    await waitFor(async () => { await record(); return (await store.get(job.id))?.state === "clarifying"; });
    await waitFor(async () => { await record(); return (await store.get(job.id))?.state === "summary"; });
    expect((await store.get(job.id))!.summary).toBe("tracks my issues instead");

    // No plan/test approval state ever appeared — every observed state is in the union.
    for (const s of seen) expect(JOB_STATES).toContain(s);
    expect(seen).toContain("clarifying");
    expect(seen).toContain("summary");
  });
});

describe("AC3 — proceed → dock, grid clean", () => {
  it("Proceed closes intake, job appears as building, grid unchanged until completion", async () => {
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
    // Job transitions to building (the dock) before it lands; landing only on done.
    await waitFor(async () => (await store.get(job.id))?.state === "done");
    expect(land).toHaveBeenCalledWith(expect.objectContaining({ widgetName: "pr-widget" }));
    expect((await store.get(job.id))!.widgetName).toBe("pr-widget");
  });
});

describe("AC4 — durable, serial", () => {
  it("a running build resumes from session_id after restart; a second submission sits in queued", async () => {
    const store = new JobStore(join(dir, "jobs"));
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
    const runner = new JobRunner({ store, agent: agent as never, root: dir, land: vi.fn(async () => {}) });
    // A fresh runner re-attaches to the interrupted build and resumes its session.
    await runner.resumeInterrupted();
    await waitFor(() => resumed.includes("sess-X"));
    expect(resumed).toContain("sess-X");
    await waitFor(async () => (await store.get(job.id))?.state === "done");
  });

  it("a second submission sits in queued while one is active", async () => {
    const store = new JobStore(join(dir, "jobs"));
    // A turn-script that parks the first job in clarifying with an unanswered
    // question, so it stays the active build and never advances.
    const agent = new FakeAgentRunner({ scripts: [[
      { type: "session", id: "s1" },
      { type: "question", toolUseId: "t1", questions: [{ question: "Which repo?", header: "Repo", options: [{ label: "sb", description: "" }], multiSelect: false }] },
    ]] });
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn() });
    const first = await runner.enqueue("a");
    await waitFor(async () => (await store.get(first.id))?.state === "clarifying");
    const second = await runner.enqueue("b");
    expect((await store.get(second.id))!.state).toBe("queued");
  });
});

describe("AC5 — mid-build question bubble-up", () => {
  it("a worker clarification puts the job in needs_input; answering resumes the build", async () => {
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
});

describe("AC6 — success landing", () => {
  it.skip("package exists, id appended to dashboard.layout.json atomically, dock row clears, widget renders", () => {});
});
describe("AC7 — emitted package is valid by construction", () => {
  it.skip("structure + golden + transport-smoke pass over the emitted package", () => {});
});
describe("AC8 — failure is legible", () => {
  it("non-convergence/unreachable MCP → failed with reason, no partial package, Refine/Discard offered", async () => {
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

    const failed = (await store.get(job.id))!;
    expect(failed.state).toBe("failed");
    // A legible, non-empty reason (the agent error or the no-[[done]] non-convergence).
    expect(failed.failureReason).toBeTruthy();
    expect(failed.failureReason).toMatch(/unreachable|without a \[\[done/i);
    // No package landed, and no widgets/<name> dir was written under the temp root.
    expect(land).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "widgets"))).toBe(false);
  });
});
describe("AC9 — no credential plumbing", () => {
  it.skip("a build authenticates by inheriting the local login — no cc-creds reader or hand-built Anthropic client", () => {});
});
