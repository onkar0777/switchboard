import { join } from "node:path";
import type { JobStore } from "./job-store";
import type { AgentRunner, Marker, QuestionAnswers } from "./agent-runner";
import type { Job, JobEvent } from "./job-types";
import { transition } from "./state-machine";

type LandFn = (input: { root: string; stageDir: string; widgetName: string }) => Promise<void>;

interface Deps {
  store: JobStore;
  agent: AgentRunner;
  root: string; // repo root
  land: LandFn;
}

// Serial orchestrator. One active build at a time; the rest sit queued. Bridges
// the agent's questions to the in-app answer channel via a per-job resolver, and
// the summary gate via a per-job proceed/feedback resolver. Landing happens only
// after a `[[done]]` marker and a successful `land()`.
export class JobRunner {
  private answerResolvers = new Map<string, (a: QuestionAnswers) => void>();
  private gateResolvers = new Map<string, (decision: "proceed" | { feedback: string }) => void>();
  private running = false;
  // Serializes read-modify-write on the store so concurrently-emitted markers
  // (e.g. [[phase]] then [[done]] within one fire-and-forget turn) don't clobber
  // each other via stale reads. One promise chain per job id.
  private mutex = new Map<string, Promise<unknown>>();

  constructor(private readonly deps: Deps) {}

  // Run `fn` after any in-flight mutation for `jobId` settles. Returns fn's result.
  private async withLock<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.mutex.get(jobId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.mutex.set(jobId, next.catch(() => {}));
    return next;
  }

  // A read that queues behind any in-flight mutation, so it observes the latest
  // fire-and-forget marker/session writes for `jobId`.
  private lockedGet(jobId: string): Promise<Job | undefined> {
    return this.withLock(jobId, () => this.deps.store.get(jobId));
  }

  private stageDir(jobId: string): string {
    return join(this.deps.root, ".switchboard", "staging", jobId);
  }

  async enqueue(intent: string): Promise<Job> {
    const job = await this.deps.store.create(intent);
    void this.pump();
    return job;
  }

  async answer(jobId: string, answers: QuestionAnswers): Promise<void> {
    const resolve = this.answerResolvers.get(jobId);
    if (!resolve) throw new Error(`no pending question for job ${jobId}`);
    this.answerResolvers.delete(jobId);
    // Optimistically clear the pending question; the agent turn continues.
    await this.apply(jobId, { kind: "answer" });
    resolve(answers);
  }

  async proceed(jobId: string): Promise<void> {
    const resolve = this.gateResolvers.get(jobId);
    if (!resolve) throw new Error(`no summary gate open for job ${jobId}`);
    this.gateResolvers.delete(jobId);
    await this.apply(jobId, { kind: "proceed" });
    resolve("proceed");
  }

  async feedback(jobId: string, text: string): Promise<void> {
    const resolve = this.gateResolvers.get(jobId);
    if (!resolve) throw new Error(`no summary gate open for job ${jobId}`);
    this.gateResolvers.delete(jobId);
    await this.apply(jobId, { kind: "feedback" });
    resolve({ feedback: text });
  }

  private async apply(jobId: string, event: JobEvent): Promise<Job> {
    return this.withLock(jobId, async () => {
      const job = await this.deps.store.get(jobId);
      if (!job) throw new Error(`job ${jobId} not found`);
      return this.deps.store.save(transition(job, event));
    });
  }

  // Picks up the next queued job if nothing is active. Serial guard.
  private async pump(): Promise<void> {
    // Claim the slot SYNCHRONOUSLY, before any await, so two concurrent
    // enqueue()-driven pumps can't both pass the guard while it's still false,
    // both await, and both drive the SAME queued job (double-drive → the loser's
    // start transition throws → failSafe corrupts a running job to failed).
    if (this.running) return;
    this.running = true;
    try {
      const active = await this.deps.store.findActive();
      if (active) {
        // An in-flight build (e.g. after restart) owns the slot — don't claim.
        this.running = false;
        return;
      }
      const next = await this.deps.store.nextQueued();
      if (!next) {
        this.running = false;
        return;
      }
      // Hand off to drive(); leave running===true for drive().finally() to reset.
      void this.drive(next.id).finally(() => {
        this.running = false;
        void this.pump(); // serve the queue
      });
    } catch (e) {
      // A store read threw before handoff — release the slot so the queue isn't
      // wedged, then rethrow so the failure isn't silently swallowed.
      this.running = false;
      throw e;
    }
  }

  // Runs a job through intake (turn 1) and, on Proceed, the build (turn 2+).
  private async drive(jobId: string): Promise<void> {
    try {
      await this.apply(jobId, { kind: "start" });
      const intent = (await this.deps.store.get(jobId))!.intent;

      // Turn 1 — intake: brainstorming until [[summary]] ends the turn.
      await this.runTurn(jobId, this.intakePrompt(jobId, intent), undefined);

      // Wait for the summary gate decision.
      const decision = await new Promise<"proceed" | { feedback: string }>((res) => this.gateResolvers.set(jobId, res));

      if (typeof decision === "object") {
        // Feedback loop: resume with the feedback, expect a new summary, re-gate.
        // (Recurse for simplicity; depth is user-bounded.)
        await this.runTurn(jobId, `The user gave feedback: ${decision.feedback}. Re-summarize.`, (await this.lockedGet(jobId))!.sessionId);
        const again = await new Promise<"proceed" | { feedback: string }>((res) => this.gateResolvers.set(jobId, res));
        if (typeof again === "object") return this.driveFeedbackThenBuild(jobId, again.feedback);
      }

      // Turn 2 — build: resume with PROCEED, run to [[done]] or [[failed]].
      await this.runTurn(jobId, "PROCEED", (await this.lockedGet(jobId))!.sessionId);
      await this.finishBuild(jobId);
    } catch (e) {
      await this.failSafe(jobId, (e as Error).message);
    }
  }

  private async driveFeedbackThenBuild(jobId: string, feedback: string): Promise<void> {
    await this.runTurn(jobId, `The user gave feedback: ${feedback}. Re-summarize.`, (await this.lockedGet(jobId))!.sessionId);
    await new Promise<"proceed" | { feedback: string }>((res) => this.gateResolvers.set(jobId, res));
    await this.runTurn(jobId, "PROCEED", (await this.lockedGet(jobId))!.sessionId);
    await this.finishBuild(jobId);
  }

  private async finishBuild(jobId: string): Promise<void> {
    // Drain any in-flight marker mutations from the just-completed turn before
    // inspecting terminal state (markers are applied fire-and-forget).
    const job = await this.withLock(jobId, () => this.deps.store.get(jobId));
    if (!job) return;
    if (job.state === "done" && job.widgetName) {
      // [[done]] already transitioned the job to done; land the staged package.
      await this.deps.land({ root: this.deps.root, stageDir: this.stageDir(jobId), widgetName: job.widgetName });
    } else if (job.state === "building") {
      // Turn ended with no [[done:<id>]] (and no [[failed]]) — non-convergence.
      await this.failSafe(jobId, "build ended without a [[done:<id>]] marker");
    }
  }

  private async failSafe(jobId: string, reason: string): Promise<void> {
    await this.withLock(jobId, async () => {
      const job = await this.deps.store.get(jobId);
      if (job && job.state !== "done" && job.state !== "failed") {
        await this.deps.store.save(transition(job, { kind: "fail", reason }));
      }
    });
  }

  // On boot, re-attach to a build that was interrupted mid-flight: resume the
  // SDK session by id and run it to completion. If it has no session id to
  // resume, fail it legibly rather than hang.
  async resumeInterrupted(): Promise<void> {
    const active = await this.deps.store.findActive();
    if (!active) return void this.pump();
    if (active.state === "building" && active.sessionId) {
      this.running = true;
      void (async () => {
        await this.runTurn(active.id, "Resume the interrupted build.", active.sessionId);
        await this.finishBuild(active.id);
      })().catch((e) => this.failSafe(active.id, (e as Error).message)).finally(() => {
        this.running = false;
        void this.pump();
      });
    } else if (active.state === "building") {
      await this.failSafe(active.id, "session could not be resumed after restart");
    }
  }

  // One query() turn. Wires agent events → state machine + the question bridge.
  private async runTurn(jobId: string, prompt: string, resume: string | undefined): Promise<void> {
    const result = await this.deps.agent.run(
      { prompt, cwd: this.deps.root, resume },
      {
        onSession: (id) => void this.saveSession(jobId, id),
        onProgress: () => {},
        onMarker: (m) => void this.onMarker(jobId, m),
        onQuestion: async (pending) => {
          await this.apply(jobId, { kind: "question", pending });
          return new Promise<QuestionAnswers>((res) => this.answerResolvers.set(jobId, res));
        },
      },
    );
    if (result.error) await this.failSafe(jobId, result.error);
  }

  private async saveSession(jobId: string, sessionId: string): Promise<void> {
    await this.withLock(jobId, async () => {
      const job = await this.deps.store.get(jobId);
      if (job && job.sessionId !== sessionId) await this.deps.store.save({ ...job, sessionId });
    });
  }

  private async onMarker(jobId: string, marker: Marker): Promise<void> {
    if (marker.kind === "summary") await this.apply(jobId, { kind: "summary", text: marker.text });
    else if (marker.kind === "phase") await this.apply(jobId, { kind: "phase", phase: marker.phase });
    else if (marker.kind === "done") await this.apply(jobId, { kind: "done", widgetName: marker.widgetName });
    else if (marker.kind === "failed") await this.failSafe(jobId, marker.reason);
  }

  private intakePrompt(jobId: string, intent: string): string {
    return [
      `Author a Switchboard widget for this intent: "${intent}".`,
      `jobId: ${jobId}. Write the final package to .switchboard/staging/${jobId}/ (spec.json + golden/cases.json).`,
      `Use the author-widget skill. Ask clarifying questions one at a time, then emit the [[summary]] marker and stop.`,
    ].join("\n");
  }
}
