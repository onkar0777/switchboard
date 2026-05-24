// @vitest-environment node
// Phase 0 — acceptance criteria for the widget authoring flow. Each is skipped
// and un-skipped by the phase that implements it. Boundaries: job-runner
// observable state, the emitted package, dashboard.layout.json, the SSE/question
// bridge. All driven by the FakeAgentRunner — no network, no real agent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobStore } from "./job-store";
import { FakeAgentRunner } from "./fake-agent-runner";
import { JobRunner } from "./job-runner";
import { landPackage } from "./landing";
import { validateStagedPackage } from "./validate-package";
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
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn(), validate: async () => ({ ok: true }) });
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
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn(), validate: async () => ({ ok: true }) });

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
    const runner = new JobRunner({ store, agent, root: dir, land, validate: async () => ({ ok: true }) });
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
    const runner = new JobRunner({ store, agent: agent as never, root: dir, land: vi.fn(async () => {}), validate: async () => ({ ok: true }) });
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
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn(), validate: async () => ({ ok: true }) });
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
    const runner = new JobRunner({ store, agent, root: dir, land: vi.fn(async () => {}), validate: async () => ({ ok: true }) });
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
  // The "dock row clears" / "widget renders" facets are UI (Task 16 + the
  // design/QA gauntlet). At this backend layer we assert the LANDING facet
  // end-to-end through the real runner + the REAL landPackage: a successful
  // build that reaches [[done:<id>]] lands the staged package, so the package
  // files exist under widgets/<id> and the layout contains the id.
  it("a successful build lands the staged package and appends the id to dashboard.layout.json", async () => {
    const root = mkdtempSync(join(tmpdir(), "sb-ac6-"));
    try {
      const store = new JobStore(join(root, ".switchboard", "jobs"));
      const agent = new FakeAgentRunner({ scripts: [
        [{ type: "session", id: "s1" }, { type: "marker", text: "[[summary]]a widget[[/summary]]" }],
        [{ type: "marker", text: "[[done:test-widget]]" }],
      ]});
      const runner = new JobRunner({ store, agent, root, land: landPackage, validate: validateStagedPackage });
      const job = await runner.enqueue("track PRs");
      await waitFor(async () => (await store.get(job.id))?.state === "summary");

      // Pre-stage the package BEFORE proceeding: finishBuild's real landPackage
      // copies .switchboard/staging/<jobId> → widgets/<widgetName>, so those
      // staged files must exist before the [[done]] marker fires. The build turn
      // only starts on proceed(), so staging now is deterministic.
      const stageDir = join(root, ".switchboard", "staging", job.id);
      mkdirSync(join(stageDir, "golden"), { recursive: true });
      const founder = join(process.cwd(), "widgets", "founder-pr-verdict");
      writeFileSync(join(stageDir, "spec.json"), readFileSync(join(founder, "spec.json"), "utf8"));
      writeFileSync(join(stageDir, "golden", "cases.json"), readFileSync(join(founder, "golden", "cases.json"), "utf8"));

      await runner.proceed(job.id);
      // Wait for the LANDING side-effect itself, not just state==="done": the
      // [[done]] marker flips state to "done" during the turn, but finishBuild's
      // landPackage runs after the turn resolves. Polling the filesystem (rather
      // than the state) closes that race under parallel test load.
      await waitFor(
        () =>
          existsSync(join(root, "widgets", "test-widget", "spec.json")) &&
          existsSync(join(root, "dashboard.layout.json")),
        5000,
      );
      expect((await store.get(job.id))?.state).toBe("done");

      // The real landPackage published the staged package under widgets/<id>.
      expect(existsSync(join(root, "widgets", "test-widget", "spec.json"))).toBe(true);
      expect(existsSync(join(root, "widgets", "test-widget", "golden", "cases.json"))).toBe(true);
      // …and appended the id to the dashboard layout.
      const layout = JSON.parse(readFileSync(join(root, "dashboard.layout.json"), "utf8"));
      expect(layout.widgets).toContain("test-widget");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
describe("AC7 — emitted package is valid by construction", () => {
  it("a package in the locked shape passes schema + golden + dry-run", async () => {
    const { validateStagedPackage } = await import("./validate-package");
    const res = await validateStagedPackage(join(process.cwd(), "widgets", "founder-pr-verdict"), new Date("2026-05-20T12:00:00.000Z"));
    expect(res.ok).toBe(true);
  });

  it("discoverWidgetPackages finds the founder package", async () => {
    const { discoverWidgetPackages } = await import("@/lib/widgets/registry");
    const pkgs = discoverWidgetPackages();
    const names = pkgs.map((p) => p.name);
    expect(names).toContain("founder-pr-verdict");
  });
});
describe("AC8 — failure is legible", () => {
  it("non-convergence/unreachable MCP → failed with reason, no partial package, Refine/Discard offered", async () => {
    const store = new JobStore(join(dir, "jobs"));
    const agent = new FakeAgentRunner({ scripts: [
      [{ type: "session", id: "s1" }, { type: "marker", text: "[[summary]]w[[/summary]]" }],
      [{ type: "error", message: "MCP server unreachable" }],
    ]});
    const land = vi.fn(async () => {});
    const runner = new JobRunner({ store, agent, root: dir, land, validate: async () => ({ ok: true }) });
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

  it("a [[done]] over a MALFORMED staged package fails the job (validate before land) and lands NOTHING", async () => {
    // C1 regression: the runner must validate the staged package BEFORE landing.
    // A real agent emitting [[done]] over a broken spec.json/cases.json must not
    // land a broken widget. With the REAL validator wired and a malformed staged
    // package, the job ends `failed` with a reason and `land` is never called.
    const store = new JobStore(join(dir, "jobs"));
    const agent = new FakeAgentRunner({ scripts: [
      [{ type: "session", id: "s1" }, { type: "marker", text: "[[summary]]w[[/summary]]" }],
      [{ type: "marker", text: "[[done:bad-widget]]" }],
    ]});
    const land = vi.fn(async () => {});
    const runner = new JobRunner({ store, agent, root: dir, land, validate: validateStagedPackage });
    const job = await runner.enqueue("track");
    await waitFor(async () => (await store.get(job.id))?.state === "summary");

    // Pre-stage a MALFORMED package before proceeding: spec.json that fails
    // WidgetSpecSchema. The build turn only starts on proceed(), so staging now
    // is deterministic.
    const stageDir = join(dir, ".switchboard", "staging", job.id);
    mkdirSync(join(stageDir, "golden"), { recursive: true });
    writeFileSync(join(stageDir, "spec.json"), '{"id":"bad"}');
    writeFileSync(join(stageDir, "golden", "cases.json"), '{"cases":[]}');

    await runner.proceed(job.id);
    await waitFor(async () => (await store.get(job.id))?.state === "failed");

    const failed = (await store.get(job.id))!;
    expect(failed.state).toBe("failed");
    expect(typeof failed.failureReason).toBe("string");
    expect(failed.failureReason!.length).toBeGreaterThan(0);
    // Validation gated landing: nothing was landed.
    expect(land).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "widgets", "bad-widget"))).toBe(false);
  });
});
describe("AC9 — no credential plumbing", () => {
  it("no authoring module reads cc-creds or constructs an Anthropic client", () => {
    const dir = join(process.cwd(), "lib", "authoring");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src).not.toMatch(/cc-creds|new Anthropic\(|@anthropic-ai\/sdk/);
    }
  });
});
