import type { PipelineInput, DslContext } from "./dsl/evaluate";
import type { WidgetSpec } from "./spec";
import { buildFixtureData } from "./fixture-data";
import { loadServerConfig } from "@/lib/mcp/server-config";
import { openRunner, type McpRunner } from "@/lib/mcp/client-manager";
import { McpBudgetError, McpDriftError } from "@/lib/mcp/errors";

export const BUDGET_MS = 45_000;

// Normalizes an MCP tool result into an array of row objects. Accepts a bare
// JSON array, the common {rows|items|results|data} wrappers, or structuredContent.
export function parseToolResult(result: unknown): Array<Record<string, unknown>> {
  const r = result as { structuredContent?: unknown; content?: Array<{ type: string; text?: string }> };
  const fromStructured = normalizeRows(r.structuredContent);
  if (fromStructured) return fromStructured;
  const text = (r.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  if (!text.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("MCP tool returned non-JSON text");
  }
  return normalizeRows(parsed) ?? [];
}

function normalizeRows(v: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
  if (v && typeof v === "object") {
    for (const key of ["rows", "items", "results", "data"]) {
      const inner = (v as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner as Array<Record<string, unknown>>;
    }
  }
  return null;
}

function resolveArgs(args: Record<string, unknown>, ctx: DslContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] = typeof v === "string" && v.startsWith("{") && v.endsWith("}") ? ctx[v.slice(1, -1)] : v;
  }
  return out;
}

// Live replacement for buildFixtureData. Opens an MCP client for spec.mcp.server
// (unless a runner is injected for tests), checks each query's tool still exists
// (drift), runs them in parallel under a 45s aggregate budget, and parses each
// result to rows. SWITCHBOARD_FORCE_MOCK=1 short-circuits to the MockAdapter path.
export async function buildMcpData(
  spec: WidgetSpec,
  ctx: DslContext,
  opts: { runner?: McpRunner } = {},
): Promise<PipelineInput> {
  if (process.env.SWITCHBOARD_FORCE_MOCK === "1") return buildFixtureData(spec, ctx);

  const ownRunner = !opts.runner;
  const runner = opts.runner ?? (await openRunner(await loadServerConfig(spec.mcp.server)));
  const controller = new AbortController();
  const budget = setTimeout(() => controller.abort(new McpBudgetError(spec.mcp.server)), BUDGET_MS);

  try {
    const available = new Set(await runner.listToolNames({ signal: controller.signal }));
    for (const q of Object.values(spec.mcp.queries)) {
      if (!available.has(q.tool)) throw new McpDriftError(spec.mcp.server, q.tool);
    }

    const names = Object.keys(spec.mcp.queries);
    const results = await Promise.all(
      names.map((name) =>
        runner.callTool(spec.mcp.queries[name].tool, resolveArgs(spec.mcp.queries[name].args, ctx), {
          signal: controller.signal,
        }),
      ),
    );

    const queries: Record<string, unknown> = {};
    names.forEach((name, i) => {
      queries[name] = parseToolResult(results[i]);
    });
    return { queries };
  } catch (err) {
    // Surface the budget error rather than the abort propagation from an in-flight call.
    const reason = controller.signal.reason;
    if (controller.signal.aborted && reason instanceof McpBudgetError) throw reason;
    throw err;
  } finally {
    clearTimeout(budget);
    if (ownRunner) await runner.close();
  }
}
