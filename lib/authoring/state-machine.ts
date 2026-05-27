import type { Job, JobEvent, JobState } from "./job-types";

export class InvalidTransitionError extends Error {
  constructor(from: JobState, event: string) {
    super(`illegal transition: ${event} from "${from}"`);
    this.name = "InvalidTransitionError";
  }
}

// Pure: given a job and an event, returns the next job. Never mutates input.
// `updatedAt` is bumped by the caller (store) on persist, not here, so the
// machine stays deterministic and clock-free.
export function transition(job: Job, event: JobEvent): Job {
  const j = { ...job };
  switch (event.kind) {
    case "start":
      if (j.state !== "queued") throw new InvalidTransitionError(j.state, event.kind);
      j.state = "clarifying";
      return j;
    case "question":
      if (j.state === "clarifying" || j.state === "summary") {
        j.state = "clarifying";
      } else if (j.state === "building" || j.state === "needs_input") {
        j.state = "needs_input";
      } else {
        throw new InvalidTransitionError(j.state, event.kind);
      }
      j.pendingQuestion = event.pending;
      return j;
    case "answer":
      if (j.state === "clarifying") {
        // stays clarifying (more questions or summary to come)
      } else if (j.state === "needs_input") {
        j.state = "building";
      } else {
        throw new InvalidTransitionError(j.state, event.kind);
      }
      delete j.pendingQuestion;
      return j;
    case "summary":
      if (j.state !== "clarifying") throw new InvalidTransitionError(j.state, event.kind);
      j.state = "summary";
      j.summary = event.text;
      delete j.pendingQuestion;
      return j;
    case "feedback":
      if (j.state !== "summary") throw new InvalidTransitionError(j.state, event.kind);
      j.state = "clarifying";
      return j;
    case "proceed":
      if (j.state !== "summary") throw new InvalidTransitionError(j.state, event.kind);
      j.state = "building";
      return j;
    case "phase":
      if (j.state !== "building") throw new InvalidTransitionError(j.state, event.kind);
      j.phase = event.phase;
      return j;
    case "done":
      if (j.state !== "building") throw new InvalidTransitionError(j.state, event.kind);
      j.state = "done";
      j.widgetName = event.widgetName;
      delete j.pendingQuestion;
      return j;
    case "fail":
      if (j.state === "done") throw new InvalidTransitionError(j.state, event.kind);
      j.state = "failed";
      j.failureReason = event.reason;
      delete j.pendingQuestion;
      return j;
  }
}
