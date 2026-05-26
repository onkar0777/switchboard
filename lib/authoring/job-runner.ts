import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { JobStore } from "./job-store";
import type { AgentRunner, Marker, QuestionAnswers } from "./agent-runner";
import type { Job, JobEvent, JobState } from "./job-types";
import { transition } from "./state-machine";

type LandFn = (input: { root: string; stageDir: string; widgetName: string }) => Promise<void>;
// Structural type for the staged-package validator (mirrors validateStagedPackage
// without importing it — keeps the runner decoupled from validate-package).
type ValidateFn = (stageDir: string, now: Date) => Promise<{ ok: true } | { ok: false; reason: string }>;

interface Deps {
  store: JobStore;
  agent: AgentRunner;
  root: string; // repo root
  land: LandFn;
  validate: ValidateFn;
}

// Thrown into a live waiter (answer/gate settler) when its job is discarded, so
// the parked turn unwinds instead of hanging forever.
export class DiscardError extends Error {
  constructor(jobId: string) {
    super(`job ${jobId} discarded`);
    this.name = "DiscardError";
  }
}

// Serial orchestrator. One active build at a time; the rest sit queued. Bridges
// the agent's questions to the in-app answer channel via a per-job resolver, and
// the summary gate via a per-job proceed/feedback resolver. Landing happens only
// after a `[[done]]` marker and a successful `land()`.
export class JobRunner {
  // Settlers (resolve + reject) so discard can REJECT a live waiter and unwind
  // its parked turn instead of leaving the Promise to hang forever.
  private answerResolvers = new Map<string, { resolve: (a: QuestionAnswers) => void; reject: (e: Error) => void }>();
  private gateResolvers = new Map<string, { resolve: (decision: "proceed" | { feedback: string }) => void; reject: (e: Error) => void }>();
  private running = false;
  // Serializes read-modify-write on the store so concurrently-emitted markers
  // (e.g. [[phase]] then [[done]] within one fire-and-forget turn) don't clobber
  // each other via stale reads. One promise chain per job id.
  private mutex = new Map<string, Promise<unknown>>();
  // A [[done]] marker only RECORDS intent to land here; the actual `done`
  // transition is deferred to finishBuild, AFTER validation succeeds. Keyed by
  // job id → staged widget name. This keeps the job in `building` through the
  // turn so failSafe can still fire if validation fails (the state machine
  // guards `fail` from the terminal `done` state).
  private pendingDone = new Map<string, string>();

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

  // The escape hatch. Idempotent + uniform across clarifying/summary/needs_input/
  // failed/queued. NOT offered on building (no live-build abort) or done. In
  // order: (1) settle any live waiter so its parked turn unwinds, (2) delete
  // durable state (job file + staging) and clear in-memory maps, (3) free + serve
  // the queue.
  async discard(jobId: string): Promise<void> {
    // Peek BEFORE deleting: only a slot-holding state (clarifying/summary/
    // needs_input) owns `running`. A queued/failed job does not — and a sibling
    // building job might, so we must never blindly clear `running`.
    const job = await this.deps.store.get(jobId);
    const heldSlot = job ? ["clarifying", "summary", "needs_input"].includes(job.state) : false;

    const gate = this.gateResolvers.get(jobId);
    const ans = this.answerResolvers.get(jobId);
    const hadLiveWaiter = Boolean(gate || ans);

    // (2) Delete durable state first, so the rejection's failSafe re-read finds
    // the file already gone and no-ops.
    await this.deps.store.delete(jobId);
    await rm(this.stageDir(jobId), { recursive: true, force: true });
    this.answerResolvers.delete(jobId);
    this.gateResolvers.delete(jobId);
    this.pendingDone.delete(jobId);
    this.mutex.delete(jobId);

    // (1) Settle the live waiter. The rejection unwinds runTurn/awaitGate →
    // drive()'s try/catch → failSafe (no-op on the deleted file) → drive().finally
    // frees the slot and pumps. So with a live waiter we DON'T touch the slot here.
    if (gate) gate.reject(new DiscardError(jobId));
    if (ans) ans.reject(new DiscardError(jobId));

    // (3) No live drive to free the slot (post-restart cold-parked, or queued/
    // failed). Free it ourselves IFF this job held it, then always pump (pump is
    // guarded by `running`, so it no-ops if a sibling build owns the slot).
    if (!hadLiveWaiter) {
      if (heldSlot) this.running = false;
      void this.pump();
    }
  }

  async answer(jobId: string, answers: QuestionAnswers): Promise<void> {
    const settler = this.answerResolvers.get(jobId);
    if (settler) {
      this.answerResolvers.delete(jobId);
      // Optimistically clear the pending question; the agent turn continues.
      await this.apply(jobId, { kind: "answer" });
      settler.resolve(answers);
      return;
    }
    // Cold path (post-restart): re-spawn the session with the answer injected.
    // {kind:"answer"} keeps a clarifying job clarifying (clears the question)
    // and moves a needs_input job to building; the continuation branches on that
    // post-apply state — clarifying expects a new summary (re-gate), building
    // finishes the build.
    const prompt = this.answerPrompt(answers);
    await this.coldResume(
      jobId,
      ["clarifying", "needs_input"],
      { kind: "answer" },
      async (job) => {
        await this.runTurn(jobId, prompt, job.sessionId);
        // `job` is the POST-apply snapshot: answer keeps clarifying→clarifying
        // (re-gate the next summary) and moves needs_input→building (finish the
        // build). If the state machine ever changed clarifying's answer edge,
        // this sentinel would need to change with it.
        if (job.state === "clarifying") await this.awaitGateThenContinue(jobId);
        else await this.finishBuild(jobId);
      },
      `no pending question for job ${jobId}`,
    );
  }

  async proceed(jobId: string): Promise<void> {
    const settler = this.gateResolvers.get(jobId);
    if (settler) {
      this.gateResolvers.delete(jobId);
      await this.apply(jobId, { kind: "proceed" });
      settler.resolve("proceed");
      return;
    }
    // Cold path (post-restart): no live gate. Reattach and build.
    await this.coldResume(
      jobId,
      ["summary"],
      { kind: "proceed" },
      // runBuild re-reads sessionId from the store (write-once), so unlike the
      // answer/feedback continuations it needn't thread the snapshot's sessionId.
      () => this.runBuild(jobId, "PROCEED"),
      `no summary gate open for job ${jobId}`,
    );
  }

  async feedback(jobId: string, text: string): Promise<void> {
    const settler = this.gateResolvers.get(jobId);
    if (settler) {
      this.gateResolvers.delete(jobId);
      await this.apply(jobId, { kind: "feedback" });
      settler.resolve({ feedback: text });
      return;
    }
    // Cold path (post-restart): re-summarize from the resumed session, then gate.
    await this.coldResume(
      jobId,
      ["summary"],
      { kind: "feedback" },
      async (job) => {
        await this.runTurn(jobId, `The user gave feedback: ${text}. Re-summarize.`, job.sessionId);
        await this.awaitGateThenContinue(jobId);
      },
      `no summary gate open for job ${jobId}`,
    );
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

      // Hand off to the shared gate tail (also re-entered by the cold path).
      await this.awaitGateThenContinue(jobId);
    } catch (e) {
      await this.failSafe(jobId, (e as Error).message);
    }
  }

  // The summary-gate tail, shared by drive() and the post-restart cold path.
  // Sets the gate resolver, awaits the decision: `proceed` builds; `feedback`
  // re-summarizes and recurses (depth is user-bounded). Replaces the old
  // driveFeedbackThenBuild duplication.
  private async awaitGateThenContinue(jobId: string): Promise<void> {
    const decision = await new Promise<"proceed" | { feedback: string }>((resolve, reject) =>
      this.gateResolvers.set(jobId, { resolve, reject }),
    );
    if (decision === "proceed") {
      await this.runBuild(jobId, "PROCEED");
    } else {
      const job = await this.lockedGet(jobId);
      if (!job) throw new DiscardError(jobId); // discarded mid-flight: unwind cleanly
      await this.runTurn(jobId, `The user gave feedback: ${decision.feedback}. Re-summarize.`, job.sessionId);
      await this.awaitGateThenContinue(jobId);
    }
  }

  // Turn 2+ — build: resume the session with `prompt`, run to [[done]]/[[failed]],
  // then validate-and-land via finishBuild. Shared by drive() and the cold path.
  private async runBuild(jobId: string, prompt: string): Promise<void> {
    const job = await this.lockedGet(jobId);
    if (!job) throw new DiscardError(jobId); // discarded mid-flight: unwind cleanly
    await this.runTurn(jobId, prompt, job.sessionId);
    await this.finishBuild(jobId);
  }

  // Post-restart cold path: no live resolver exists. Validate the parked state,
  // claim the serial slot SYNCHRONOUSLY (before any await, like pump()), apply
  // the entry transition, then spawn a continuation that re-spawns the agent
  // from the persisted sessionId and runs to the next durable stop. A concurrent
  // POST while a cold resume is in flight sees running===true → 409 ("runner
  // busy"). On any failure the continuation fails the job legibly with a reason
  // that names the resume — "fail legibly + Discard", no retry.
  private async coldResume(
    jobId: string,
    expectStates: JobState[],
    entry: JobEvent,
    continuation: (job: Job) => Promise<void>,
    notReadyMsg: string,
  ): Promise<void> {
    if (this.running) throw new Error("runner busy");
    this.running = true;
    let job: Job;
    try {
      const parked = await this.lockedGet(jobId);
      if (!parked || !expectStates.includes(parked.state)) throw new Error(notReadyMsg);
      job = await this.apply(jobId, entry); // persisted, post-transition job
    } catch (e) {
      this.running = false;
      throw e; // surfaces as the route's 409 (not-ready) or "runner busy"
    }
    const resumed = job;
    void continuation(resumed)
      .catch((e) => this.failSafe(jobId, `couldn't resume session after restart: ${(e as Error).message}`))
      .finally(() => {
        this.running = false;
        void this.pump(); // serve the queue once the slot frees
      });
  }

  // Self-contained resume prompt that injects the user's answer into a resumed
  // session (the parked turn's tool_use is gone after a restart). See the spec's
  // "known risk": pin real SDK behavior in the gated eval (Task 14).
  private answerPrompt(answers: QuestionAnswers): string {
    const parts = Object.entries(answers).map(([q, a]) => `${q}: ${Array.isArray(a) ? a.join(", ") : a}`);
    return `The user answered — ${parts.join("; ")}. Continue.`;
  }

  private async finishBuild(jobId: string): Promise<void> {
    // Drain any in-flight marker mutations from the just-completed turn before
    // inspecting state (markers are applied fire-and-forget).
    const job = await this.lockedGet(jobId);
    if (!job) return;
    // If the turn already drove the job terminal (e.g. an agent error fired
    // failSafe, or a [[failed]] marker), there's nothing left to do — and any
    // stashed pendingDone is moot. Don't attempt a done after failed.
    if (job.state !== "building") {
      this.pendingDone.delete(jobId);
      return;
    }

    const widgetName = this.pendingDone.get(jobId);
    if (widgetName) {
      this.pendingDone.delete(jobId);
      // Validate the staged package BEFORE landing. "done" must mean
      // "validated AND landed": a malformed package fails the job and lands
      // nothing. validate + land run OUTSIDE the lock (slow); the job stays
      // `building` so failSafe's `fail` transition is legal on failure.
      const res = await this.deps.validate(this.stageDir(jobId), new Date());
      if (!res.ok) {
        await this.failSafe(jobId, res.reason);
        return;
      }
      await this.deps.land({ root: this.deps.root, stageDir: this.stageDir(jobId), widgetName });
      await this.apply(jobId, { kind: "done", widgetName }); // done = validated + landed
    } else {
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
          return new Promise<QuestionAnswers>((resolve, reject) => this.answerResolvers.set(jobId, { resolve, reject }));
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
    else if (marker.kind === "done") {
      // Defer the `done` transition: just record the intent to land. The job
      // stays `building` until finishBuild validates the staged package, so a
      // malformed package can still be failed (you can't `fail` from `done`).
      this.pendingDone.set(jobId, marker.widgetName);
    } else if (marker.kind === "failed") await this.failSafe(jobId, marker.reason);
  }

  private intakePrompt(jobId: string, intent: string): string {
    return [
      `Author a Switchboard widget for this intent: "${intent}".`,
      `jobId: ${jobId}. Write the final package to .switchboard/staging/${jobId}/ (spec.json + golden/cases.json).`,
      `Use the author-widget skill. Ask clarifying questions one at a time, then emit the [[summary]] marker and stop.`,
    ].join("\n");
  }
}
