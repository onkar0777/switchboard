import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BuildDock } from "./BuildDock";
import type { Job } from "@/lib/authoring/job-types";

// happy-dom has no EventSource; the dock opens one per active job. Stub it.
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const needsInputJob: Job = {
  id: "job-1",
  intent: "Track stale Confluence docs",
  state: "needs_input",
  createdAt: "2026-05-24T00:00:00Z",
  updatedAt: "2026-05-24T00:00:00Z",
  pendingQuestion: {
    toolUseId: "tu-1",
    questions: [
      {
        question: "Which workspace?",
        header: "Workspace",
        options: [
          { label: "Engineering", description: "" },
          { label: "Product", description: "" },
        ],
        multiSelect: false,
      },
    ],
  },
};

describe("BuildDock needs_input free-text", () => {
  it("submits a custom typed answer, not just the offered options", async () => {
    render(<BuildDock initialJobs={[needsInputJob]} />);

    fireEvent.change(screen.getByPlaceholderText("Or type your own…"), {
      target: { value: "The Platform space" },
    });
    fireEvent.click(screen.getByText("Send"));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/widgets/job-1/answer",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ kind: "answer", answers: { "Which workspace?": "The Platform space" } });
  });

  it("still submits an offered option when clicked", async () => {
    render(<BuildDock initialJobs={[needsInputJob]} />);
    fireEvent.click(screen.getByText("Engineering"));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.answers).toEqual({ "Which workspace?": "Engineering" });
  });
});
