import { MockAdapter } from "@/lib/mcp/mock";
import type { PipelineInput, DslContext } from "./dsl/evaluate";
import type { WidgetSpec } from "./spec";

// Step 2/3 data source: runs the spec's named MCP queries against v1's
// MockAdapter over MOCK_PRS. Query args reference ctx vars as "{name}". Step 4
// swaps this for the real MCP client-manager with no change to the runtime.
export async function buildFixtureData(spec: WidgetSpec, ctx: DslContext): Promise<PipelineInput> {
  const adapter = new MockAdapter();
  const queries: Record<string, unknown> = {};

  for (const [name, q] of Object.entries(spec.mcp.queries)) {
    const args = resolveArgs(q.args, ctx);
    if (q.tool === "list_merged_prs") {
      const res = await adapter.listMergedPRs(args as never);
      if (!res.ok) throw new Error(`fixture query "${name}" failed: ${res.error.message}`);
      queries[name] = res.data;
    } else if (q.tool === "list_open_prs") {
      const res = await adapter.listOpenPRs(args as never);
      if (!res.ok) throw new Error(`fixture query "${name}" failed: ${res.error.message}`);
      queries[name] = res.data;
    } else {
      throw new Error(`fixture builder does not know tool "${q.tool}"`);
    }
  }
  return { queries };
}

function resolveArgs(args: Record<string, unknown>, ctx: DslContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] = typeof v === "string" && v.startsWith("{") && v.endsWith("}") ? ctx[v.slice(1, -1)] : v;
  }
  return out;
}
