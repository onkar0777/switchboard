import type { AgentEvents, AgentResult, AgentRunInput, AgentRunner } from "./agent-runner";
import { parseMarkers } from "./agent-runner";
import type { PendingQuestion } from "./job-types";

export type ScriptStep =
  | { type: "session"; id: string }
  | { type: "progress"; text: string }
  | { type: "marker"; text: string } // parsed via parseMarkers
  | { type: "question"; toolUseId: string; questions: PendingQuestion["questions"] }
  | { type: "error"; message: string };

// Deterministic AgentRunner for the fast gate. Replays a scripted step list,
// driving the same events the real driver does. `run` can be called repeatedly
// to simulate resumed turns (pass a fresh script per turn via the constructor's
// `scripts` queue, or a single `script` for one turn).
export class FakeAgentRunner implements AgentRunner {
  private queue: ScriptStep[][];
  constructor(opts: { script?: ScriptStep[]; scripts?: ScriptStep[][] }) {
    this.queue = opts.scripts ?? (opts.script ? [opts.script] : []);
  }

  async run(_input: AgentRunInput, events: AgentEvents): Promise<AgentResult> {
    const script = this.queue.shift() ?? [];
    let sessionId: string | undefined;
    for (const step of script) {
      if (step.type === "session") {
        sessionId = step.id;
        events.onSession(step.id);
      } else if (step.type === "progress") {
        events.onProgress(step.text);
      } else if (step.type === "marker") {
        events.onProgress(step.text);
        for (const marker of parseMarkers(step.text)) events.onMarker(marker);
      } else if (step.type === "question") {
        await events.onQuestion({ toolUseId: step.toolUseId, questions: step.questions });
      } else if (step.type === "error") {
        return { sessionId, endedTurn: true, error: step.message };
      }
    }
    return { sessionId, endedTurn: true };
  }
}
