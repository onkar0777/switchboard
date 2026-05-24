// @vitest-environment node
// Phase 0 — acceptance criteria for the golden widget test architecture.
// Each is skipped (it.skip) and un-skipped by the phase that implements it.
// They assert at stable boundaries: the discovered package set, execute() output,
// loadWidget state, and the deleted-symbol surface.
import { describe, it } from "vitest";

describe("AC1 — structure suite over any registered widget", () => {
  it.skip("validates schema/pipeline/slots/state-machine/deeplink/DESIGN-color and trips a min-count guard", () => {});
});
describe("AC2 — golden semantics from given → then", () => {
  it.skip("matches state, verdict string, status, slot ids+order, momentum, action", () => {});
});
describe("AC3 — empty state", () => {
  it.skip("empty given produces no false verdict (template-correct state)", () => {});
});
describe("AC4 — transport smoke per widget", () => {
  it.skip("happy given replayed over real stub-MCP yields state=ok and the verdict literal", () => {});
});
describe("AC5 — no v1 oracle", () => {
  it.skip("computeVerdict and the parity tests no longer exist; full suite green without them", () => {});
});
