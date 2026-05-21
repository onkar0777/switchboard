import { WidgetSpecSchema } from "./spec";
import { parsePipeline } from "./dsl";
import { buildContext } from "./ctx";
import { buildFixtureData } from "./fixture-data";
import { execute, validateDeeplinkFields } from "./runtime";
import type { GridWidget } from "@/components/DashboardGrid";
import founderSpecJson from "@/widgets/founder-pr-verdict.spec.json";

// Step 3 data path: drives the founder widget from spec -> fixture (MockAdapter
// over MOCK_PRS) -> runtime. Step 4 replaces buildFixtureData with the live MCP
// client-manager; nothing else here changes.
export async function loadFounderWidget(now: Date = new Date()): Promise<GridWidget> {
  const spec = WidgetSpecSchema.parse(founderSpecJson);
  try {
    const ctx = buildContext(spec, now);
    const data = await buildFixtureData(spec, ctx);

    // Save-time-style deeplink check against a representative row.
    const sample = (data.queries.merged as Record<string, unknown>[])[0];
    if (sample) validateDeeplinkFields(spec.deeplink, sample);

    const output = execute(
      { verdict: { pipeline: parsePipeline(spec.verdict.pipeline) }, deeplink: spec.deeplink, render: spec.render },
      data,
      ctx,
    );
    return { id: spec.id, title: spec.title, size: spec.size, template: spec.render.template, output };
  } catch (err) {
    return {
      id: spec.id,
      title: spec.title,
      size: spec.size,
      template: spec.render.template,
      output: { verdict: "", value: null, status: "neutral", state: "error", rows: [], slots: {} },
      errorMessage: err instanceof Error ? err.message : "Widget broken — open spec to inspect.",
    };
  }
}
