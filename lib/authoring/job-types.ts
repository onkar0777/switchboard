// lib/authoring/job-types.ts
// The durable shape persisted at .switchboard/jobs/<id>.json and the events that
// drive its state machine. State transitions live in state-machine.ts (pure).

export type JobState =
  | "queued"
  | "clarifying"
  | "summary"
  | "building"
  | "needs_input"
  | "done"
  | "failed";

// A question surfaced via the SDK's canUseTool(AskUserQuestion) bridge. Mirrors
// the AskUserQuestion input shape so the UI can render it directly.
export interface PendingQuestion {
  toolUseId: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>;
}

// Build phase detail for the dock (planning → implementing → testing → dry-run).
export type BuildPhase = "planning" | "implementing" | "testing" | "dry-run";

export interface Job {
  id: string;
  intent: string;
  state: JobState;
  sessionId?: string; // SDK session id; enables durable resume
  createdAt: string;
  updatedAt: string;
  pendingQuestion?: PendingQuestion; // set in clarifying/needs_input
  summary?: string; // set when state === "summary"
  phase?: BuildPhase; // dock progress detail while building
  failureReason?: string; // set when state === "failed"
  widgetName?: string; // set when state === "done"
}

// Events the state machine consumes. The runner/driver emit these.
export type JobEvent =
  | { kind: "start" }
  | { kind: "question"; pending: PendingQuestion }
  | { kind: "answer" }
  | { kind: "summary"; text: string }
  | { kind: "feedback" }
  | { kind: "proceed" }
  | { kind: "phase"; phase: BuildPhase }
  | { kind: "done"; widgetName: string }
  | { kind: "fail"; reason: string };
