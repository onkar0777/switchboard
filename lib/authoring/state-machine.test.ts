// lib/authoring/state-machine.test.ts
import { describe, expect, it } from "vitest";
import { transition, InvalidTransitionError } from "./state-machine";
import type { Job } from "./job-types";

const base: Job = {
  id: "j1", intent: "track X", state: "queued",
  createdAt: "2026-05-24T00:00:00.000Z", updatedAt: "2026-05-24T00:00:00.000Z",
};
const pending = { toolUseId: "t1", questions: [{ question: "Which repo?", header: "Repo", options: [{ label: "a", description: "" }], multiSelect: false }] };

describe("transition", () => {
  it("queued --start--> clarifying", () => {
    expect(transition(base, { kind: "start" }).state).toBe("clarifying");
  });
  it("clarifying --question--> clarifying with pendingQuestion set", () => {
    const j = transition({ ...base, state: "clarifying" }, { kind: "question", pending });
    expect(j.state).toBe("clarifying");
    expect(j.pendingQuestion).toEqual(pending);
  });
  it("clarifying --answer--> clarifying with pendingQuestion cleared", () => {
    const j = transition({ ...base, state: "clarifying", pendingQuestion: pending }, { kind: "answer" });
    expect(j.state).toBe("clarifying");
    expect(j.pendingQuestion).toBeUndefined();
  });
  it("clarifying --summary--> summary with text", () => {
    const j = transition({ ...base, state: "clarifying" }, { kind: "summary", text: "builds a PR widget" });
    expect(j.state).toBe("summary");
    expect(j.summary).toBe("builds a PR widget");
  });
  it("summary --feedback--> clarifying (no approval gate)", () => {
    expect(transition({ ...base, state: "summary", summary: "x" }, { kind: "feedback" }).state).toBe("clarifying");
  });
  it("summary --proceed--> building", () => {
    expect(transition({ ...base, state: "summary" }, { kind: "proceed" }).state).toBe("building");
  });
  it("building --question--> needs_input (mid-build bubble-up)", () => {
    const j = transition({ ...base, state: "building" }, { kind: "question", pending });
    expect(j.state).toBe("needs_input");
    expect(j.pendingQuestion).toEqual(pending);
  });
  it("needs_input --answer--> building", () => {
    const j = transition({ ...base, state: "needs_input", pendingQuestion: pending }, { kind: "answer" });
    expect(j.state).toBe("building");
    expect(j.pendingQuestion).toBeUndefined();
  });
  it("building --phase--> building with phase detail", () => {
    expect(transition({ ...base, state: "building" }, { kind: "phase", phase: "testing" }).phase).toBe("testing");
  });
  it("building --done--> done with widgetName", () => {
    const j = transition({ ...base, state: "building" }, { kind: "done", widgetName: "pr-widget" });
    expect(j.state).toBe("done");
    expect(j.widgetName).toBe("pr-widget");
  });
  it("building --fail--> failed with reason", () => {
    const j = transition({ ...base, state: "building" }, { kind: "fail", reason: "MCP unreachable" });
    expect(j.state).toBe("failed");
    expect(j.failureReason).toBe("MCP unreachable");
  });
  it("rejects an illegal transition (done --start)", () => {
    expect(() => transition({ ...base, state: "done" }, { kind: "start" })).toThrow(InvalidTransitionError);
  });
});
