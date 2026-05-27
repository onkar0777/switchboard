import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AuthoringSurface } from "./AuthoringSurface";
import type { Job } from "@/lib/authoring/job-types";

class StubEventSource {
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor(public url: string) {}
  close() {}
}
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("EventSource", StubEventSource as unknown as typeof EventSource);
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const noop = () => {};
function surface(job: Job) {
  return <AuthoringSurface job={job} onCreated={noop} onUpdate={noop} onGone={noop} onCloseDraft={noop} />;
}
function base(overrides: Partial<Job>): Job {
  return { id: "j", intent: "Track docs", state: "summary", createdAt: "2026-05-24T00:00:00Z", updatedAt: "2026-05-24T00:00:00Z", ...overrides };
}
const question = {
  toolUseId: "tu-1",
  questions: [{ question: "Which workspace?", header: "Workspace", options: [{ label: "Engineering", description: "" }], multiSelect: false }],
};

describe("AC7 — surface rehydrates per persisted state", () => {
  it("clarifying → expanded question", () => {
    render(surface(base({ state: "clarifying", pendingQuestion: question })));
    expect(screen.getByText("Which workspace?")).toBeTruthy();
  });
  it("summary → expanded summary with Proceed + feedback", () => {
    render(surface(base({ state: "summary", summary: "builds a docs widget" })));
    expect(screen.getByText("Proceed")).toBeTruthy();
    expect(screen.getByText("builds a docs widget")).toBeTruthy();
  });
  it("failed → expanded reason + Discard", () => {
    render(surface(base({ state: "failed", failureReason: "couldn't resume session after restart" })));
    expect(screen.getByText("couldn't resume session after restart")).toBeTruthy();
    expect(screen.getByText("Discard")).toBeTruthy();
  });
  it("building → collapsed chip (no Proceed, no full panel)", () => {
    render(surface(base({ state: "building", phase: "implementing" })));
    expect(screen.queryByText("Proceed")).toBeNull();
    expect(screen.getByText(/implementing/)).toBeTruthy();
  });
  it("needs_input → expanded question (the build needs you)", () => {
    render(surface(base({ state: "needs_input", pendingQuestion: question })));
    expect(screen.getByText("Which workspace?")).toBeTruthy();
  });
});

describe("shared question — free-text escape hatch", () => {
  it("submits a custom typed answer, not just the offered options", () => {
    render(surface(base({ state: "needs_input", pendingQuestion: question })));
    fireEvent.change(screen.getByPlaceholderText("Type a different answer…"), { target: { value: "The Platform space" } });
    fireEvent.click(screen.getByText("Submit answer"));
    const body = JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
    expect(body).toEqual({ kind: "answer", answers: { "Which workspace?": "The Platform space" } });
  });
});
