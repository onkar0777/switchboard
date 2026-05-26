import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { AddWidgetButton } from "./AddWidgetButton";
import type { Job } from "@/lib/authoring/job-types";

// happy-dom has no EventSource; the surface opens one for a bound job. Stub it.
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

function job(overrides: Partial<Job>): Job {
  return {
    id: "job-1", intent: "Track stale Confluence docs", state: "summary",
    createdAt: "2026-05-24T00:00:00Z", updatedAt: "2026-05-24T00:00:00Z", ...overrides,
  };
}

describe("AC8 — Add-Widget gating", () => {
  it("shows + Add widget when there is no current job", () => {
    render(<AddWidgetButton initialJobs={[]} />);
    expect(screen.getByText("+ Add widget")).toBeTruthy();
  });
  it("hides + Add widget when a non-terminal job is current", () => {
    render(<AddWidgetButton initialJobs={[job({ state: "summary", summary: "x" })]} />);
    expect(screen.queryByText("+ Add widget")).toBeNull();
  });
  it("treats an undiscarded failed job as the current job (button hidden)", () => {
    render(<AddWidgetButton initialJobs={[job({ state: "failed", failureReason: "MCP unreachable" })]} />);
    expect(screen.queryByText("+ Add widget")).toBeNull();
    expect(screen.getByText("MCP unreachable")).toBeTruthy();
  });
});

describe("AC9 — Discard from the surface clears it", () => {
  it("DELETEs the job and reveals + Add widget when nothing else lingers", async () => {
    render(<AddWidgetButton initialJobs={[job({ state: "failed", failureReason: "MCP unreachable" })]} />);
    fireEvent.click(screen.getByText("Discard"));
    expect(fetchMock).toHaveBeenCalledWith("/api/widgets/job-1", expect.objectContaining({ method: "DELETE" }));
    await waitFor(() => expect(screen.getByText("+ Add widget")).toBeTruthy());
  });
});
