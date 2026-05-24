// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobStore } from "./job-store";
import { JobRunner } from "./job-runner";
import { ClaudeAgentRunner } from "./claude-agent-runner";
import { landPackage } from "./landing";
import { validateStagedPackage } from "./validate-package";

const RUN = process.env.SWITCHBOARD_RUN_EVAL === "1";

describe.skipIf(!RUN)("authoring eval (real agent, gated)", () => {
  it("a representative intent emits a package that passes schema + golden + dry-run", async () => {
    const root = mkdtempSync(join(tmpdir(), "sb-eval-"));
    try {
      const store = new JobStore(join(root, ".switchboard", "jobs"));
      const captured: { name?: string } = {};
      const runner = new JobRunner({
        store,
        agent: new ClaudeAgentRunner(),
        root,
        land: async (i) => {
          captured.name = i.widgetName;
          await landPackage(i);
        },
        validate: validateStagedPackage,
      });
      const job = await runner.enqueue(
        "Track how many of my GitHub PRs merged this week against a target of 5",
      );

      // Poll + auto-answer loop: pick the first option for any pending question,
      // proceed past any summary, until the job is done/failed or the bound elapses.
      //
      // De-duplication key: we track the last (state, pendingQuestion toolUseId)
      // combination we acted on, so we send exactly one answer/proceed per
      // distinct transition rather than hammering the runner on every tick.
      const POLL_MS = 1000;
      const WALL_CLOCK_MS = 25 * 60 * 1000; // 25-minute safety bound
      const deadline = Date.now() + WALL_CLOCK_MS;

      let lastActedState: string | undefined;
      let lastActedQuestionId: string | undefined;

      while (Date.now() < deadline) {
        const current = await store.get(job.id);
        if (!current) break;

        const { state, pendingQuestion } = current;

        // Terminal: stop polling.
        if (state === "done" || state === "failed") break;

        // Build a dedup key for this snapshot.
        const questionId = pendingQuestion?.toolUseId;
        const alreadyActed =
          lastActedState === state && lastActedQuestionId === questionId;

        if (!alreadyActed) {
          if ((state === "clarifying" || state === "needs_input") && pendingQuestion) {
            // Auto-answer: pick the first option of the first question.
            const q = pendingQuestion.questions[0];
            await runner.answer(job.id, { [q.question]: q.options[0].label });
            lastActedState = state;
            lastActedQuestionId = questionId;
          } else if (state === "summary") {
            // Proceed past the summary gate.
            await runner.proceed(job.id);
            lastActedState = state;
            lastActedQuestionId = undefined;
          }
        }

        await new Promise<void>((res) => setTimeout(res, POLL_MS));
      }

      const final = await store.get(job.id);
      expect(final?.state).toBe("done");
      const res = await validateStagedPackage(
        join(root, "widgets", captured.name!),
        new Date(),
      );
      expect(res.ok).toBe(true);
      expect(existsSync(join(root, "dashboard.layout.json"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30 * 60 * 1000); // multi-hour cap is environment-set; this is a generous ceiling
});
