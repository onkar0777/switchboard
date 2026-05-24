// lib/authoring/agent-runner.test.ts
import { describe, expect, it, vi } from "vitest";
import { parseMarkers } from "./agent-runner";
import { FakeAgentRunner } from "./fake-agent-runner";

describe("parseMarkers", () => {
  it("extracts phase, summary, done, failed markers from agent text", () => {
    expect(parseMarkers("[[phase:testing]]")).toEqual([{ kind: "phase", phase: "testing" }]);
    expect(parseMarkers("[[summary]]builds a PR widget[[/summary]]")).toEqual([{ kind: "summary", text: "builds a PR widget" }]);
    expect(parseMarkers("[[done:pr-widget]]")).toEqual([{ kind: "done", widgetName: "pr-widget" }]);
    expect(parseMarkers("[[failed:MCP unreachable]]")).toEqual([{ kind: "failed", reason: "MCP unreachable" }]);
    expect(parseMarkers("ordinary text")).toEqual([]);
  });
});

describe("FakeAgentRunner", () => {
  it("emits a scripted clarifying question, captures the injected answer, then summarizes", async () => {
    const runner = new FakeAgentRunner({
      script: [
        { type: "session", id: "sess-1" },
        { type: "question", toolUseId: "t1", questions: [{ question: "Which repo?", header: "Repo", options: [{ label: "switchboard", description: "" }], multiSelect: false }] },
        { type: "marker", text: "[[summary]]builds a PR widget[[/summary]]" },
      ],
    });
    const answered = vi.fn(async () => ({ "Which repo?": "switchboard" }));
    const onSession = vi.fn();
    const onMarker = vi.fn();
    const res = await runner.run(
      { prompt: "track my PRs", cwd: "/x" },
      { onSession, onMarker, onQuestion: answered, onProgress: vi.fn() },
    );
    expect(onSession).toHaveBeenCalledWith("sess-1");
    expect(answered).toHaveBeenCalledOnce();
    expect(onMarker).toHaveBeenCalledWith({ kind: "summary", text: "builds a PR widget" });
    expect(res.endedTurn).toBe(true);
  });
});
