import { WidgetSpecSchema, type WidgetSpec } from "./spec";
import { parsePipeline } from "./dsl";
import { buildContext } from "./ctx";
import { buildMcpData } from "./mcp-data";
import { execute, validateDeeplinkFields, type WidgetState } from "./runtime";
import { validateSlots, type TemplateName } from "./template-slots";
import { describeMcpError } from "@/lib/mcp/errors";
import type { McpRunner } from "@/lib/mcp/client-manager";
import type { GridWidget } from "@/components/DashboardGrid";
import founderSpecJson from "@/widgets/founder-pr-verdict.spec.json";
import founderLiveSpecJson from "@/widgets/founder-pr-verdict.live.spec.json";

function allEmpty(queries: Record<string, unknown>): boolean {
  const vals = Object.values(queries);
  return vals.length > 0 && vals.every((v) => Array.isArray(v) && v.length === 0);
}

// Generic widget loader: spec -> ctx -> live MCP data (or mock under FORCE_MOCK)
// -> runtime. Derives `state` here (the runtime stays pure and always emits "ok").
export async function loadWidget(
  spec: WidgetSpec,
  now: Date = new Date(),
  opts: { runner?: McpRunner } = {},
): Promise<GridWidget> {
  try {
    const ctx = buildContext(spec, now);
    const data = await buildMcpData(spec, ctx, opts);

    const output = execute(
      { verdict: { pipeline: parsePipeline(spec.verdict.pipeline) }, deeplink: spec.deeplink, render: spec.render },
      data,
      ctx,
    );

    // Save-time-style deeplink check against an actually-rendered row (the row
    // set the widget renders, not an unrelated non-empty query), if any.
    if (output.rows[0]) validateDeeplinkFields(spec.deeplink, output.rows[0]);
    validateSlots(spec.render.template as TemplateName, output.slots);

    // "empty" only suppresses templates that have nothing to show without rows
    // (list). Verdict-computing templates render their authored zero verdict
    // (e.g. "Behind: 0/5 … the week is yours.") even when every query is empty.
    const state: WidgetState = spec.render.template === "list" && allEmpty(data.queries) ? "empty" : "ok";
    return { id: spec.id, title: spec.title, size: spec.size, template: spec.render.template, output: { ...output, state } };
  } catch (err) {
    return {
      id: spec.id,
      title: spec.title,
      size: spec.size,
      template: spec.render.template,
      output: { verdict: "", value: null, status: "neutral", state: "error", rows: [], slots: {} },
      errorMessage: describeMcpError(err, spec.mcp.server),
    };
  }
}

export async function loadFounderWidget(now: Date = new Date()): Promise<GridWidget> {
  return loadWidget(WidgetSpecSchema.parse(founderSpecJson), now);
}

// Live variant: the founder widget wired to the real GitHub MCP server's
// `search_pull_requests` tool (see widgets/founder-pr-verdict.live.spec.json).
// The page uses this; the mock parity oracle (loadFounderWidget) is unchanged.
export async function loadFounderWidgetLive(now: Date = new Date()): Promise<GridWidget> {
  return loadWidget(WidgetSpecSchema.parse(founderLiveSpecJson), now);
}
