import { describe, expect, it } from "vitest";
import { computeVerdict } from "@/lib/verdicts/engine";
import { MockAdapter } from "@/lib/mcp/mock";
import type { GoalConfig } from "@/lib/verdicts/types";
import { WidgetSpecSchema } from "./spec";
import { parsePipeline } from "./dsl";
import { buildContext } from "./ctx";
import { buildFixtureData } from "./fixture-data";
import { execute } from "./runtime";
import founderSpecJson from "@/widgets/founder-pr-verdict.spec.json";

// ★ v1-PARITY GATE.
// The runtime executing founder-pr-verdict.spec.json over MOCK_PRS must
// reproduce v1's computeVerdict BYTE-FOR-BYTE on verdict text, receipts, drag,
// momentum, and the Monday Move. The status enum is INTENTIONALLY NOT asserted
// equal to v1's — v1 emits "on_track", the runtime emits canonical "good"
// (Decision 1). That divergence is the whole point of the refactor.
const NOW = new Date("2026-05-06T12:00:00.000Z");
const GOAL: GoalConfig = {
  kind: "github_prs_merged",
  label: "Ship 5 PRs this week",
  target: 5,
  unit: "PR",
  repos: ["onkarsingh/switchboard", "onkarsingh/other-repo"],
  author: "onkarsingh",
};

describe("parity gate: founder-pr-verdict spec vs v1 computeVerdict", () => {
  it("reproduces v1 byte-for-byte (except the deliberately-changed status enum)", async () => {
    // v1 oracle
    const oracle = await computeVerdict(new MockAdapter(), GOAL, NOW);
    expect(oracle.ok).toBe(true);
    if (!oracle.ok) return;
    const v1 = oracle.data;

    // new runtime
    const spec = WidgetSpecSchema.parse(founderSpecJson);
    const ctx = buildContext(spec, NOW);
    const data = await buildFixtureData(spec, ctx);
    const out = execute(
      { verdict: { pipeline: parsePipeline(spec.verdict.pipeline) }, deeplink: spec.deeplink, render: spec.render },
      data,
      ctx,
    );

    // verdict text — byte identical
    expect(out.verdict).toBe(v1.headline);

    // receipts — same ids, same order; each deeplink == v1 row url
    const outReceiptIds = (out.slots.receipts as { id: string }[]).map((r) => r.id);
    expect(outReceiptIds).toEqual(v1.receipts.map((r) => r.id));
    expect(out.rows.length).toBeGreaterThan(0);
    for (const row of out.rows) {
      const match = v1.receipts.find((r) => r.id === (row as unknown as { id: string }).id);
      expect(row.deeplink).toBe(match?.url);
    }

    // drag — same ids, same order
    const outDragIds = (out.slots.drag as { id: string }[]).map((r) => r.id);
    expect(outDragIds).toEqual(v1.drag.map((r) => r.id));

    // momentum — identical
    expect(out.momentum).toEqual(v1.momentum);

    // Monday Move — byte identical
    expect(out.slots.action).toBe(v1.mondayMove);

    // status — DELIBERATELY divergent: assert the mapped canonical value,
    // and assert it does NOT equal v1's enum.
    expect(out.status).toBe("good");
    expect(out.status).not.toBe(v1.status); // v1 = "on_track"
  });
});
