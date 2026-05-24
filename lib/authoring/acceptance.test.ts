// @vitest-environment node
// Phase 0 — acceptance criteria for the widget authoring flow. Each is skipped
// and un-skipped by the phase that implements it. Boundaries: job-runner
// observable state, the emitted package, dashboard.layout.json, the SSE/question
// bridge. All driven by the FakeAgentRunner — no network, no real agent.
import { describe, it } from "vitest";

describe("AC1 — intent → questions → summary", () => {
  it.skip("clarifying questions surface in-app one at a time; answering reaches a build summary with Proceed/Feedback", () => {});
});
describe("AC2 — feedback loop", () => {
  it.skip("Give feedback returns to clarifying and re-summarizes; no plan/test approval is ever shown", () => {});
});
describe("AC3 — proceed → dock, grid clean", () => {
  it.skip("Proceed closes intake, job appears as building, grid unchanged until completion", () => {});
});
describe("AC4 — durable, serial", () => {
  it.skip("a running build resumes from session_id after restart; a second submission sits in queued", () => {});
});
describe("AC5 — mid-build question bubble-up", () => {
  it.skip("a worker clarification puts the job in needs_input; answering resumes the build", () => {});
});
describe("AC6 — success landing", () => {
  it.skip("package exists, id appended to dashboard.layout.json atomically, dock row clears, widget renders", () => {});
});
describe("AC7 — emitted package is valid by construction", () => {
  it.skip("structure + golden + transport-smoke pass over the emitted package", () => {});
});
describe("AC8 — failure is legible", () => {
  it.skip("non-convergence/unreachable MCP → failed with reason, no partial package, Refine/Discard offered", () => {});
});
describe("AC9 — no credential plumbing", () => {
  it.skip("a build authenticates by inheriting the local login — no cc-creds reader or hand-built Anthropic client", () => {});
});
