import { z } from "zod";

const McpQuerySchema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  // Optional rename map applied to each returned row: canonicalField -> source
  // path (dotted, e.g. "base.repo.full_name"). Normalizes a server's native
  // result shape (e.g. GitHub's minimal PR) into the canonical row fields the
  // verdict pipeline and deeplink expect. Omit when the server already returns
  // canonical rows (the mock/parity path).
  map: z.record(z.string(), z.string()).optional(),
});

// The verdict pipeline is validated structurally by the DSL parser (lib/widgets/dsl/parse.ts),
// not by zod — zod only confirms it is an array here.
export const DeterministicVerdictSchema = z.object({
  kind: z.literal("deterministic"),
  pipeline: z.array(z.unknown()),
});

export const VerdictGenSchema = z.discriminatedUnion("kind", [DeterministicVerdictSchema]);

export const WidgetSpecSchema = z.object({
  schemaVersion: z.literal("1.0"),
  id: z.string().min(1),
  title: z.string().min(1),
  size: z.enum(["S", "M", "L"]),
  // DSL literal namespace (e.g. { target: 5 }). Merged into the runtime ctx.
  params: z.record(z.string(), z.unknown()).default({}),
  mcp: z.object({
    server: z.string().min(1),
    queries: z.record(z.string(), McpQuerySchema),
  }),
  verdict: VerdictGenSchema,
  deeplink: z.object({
    template: z.string(),
    fields: z.record(z.string(), z.string()),
  }),
  refresh: z.object({
    mode: z.enum(["on_view", "manual"]),
    cacheSeconds: z.number().int().min(0).default(3600),
  }),
  render: z.object({
    template: z.enum(["scoreboard", "list", "single_stat", "verdict_card"]),
    slots: z.record(z.string(), z.unknown()),
  }),
  authoredBy: z.object({
    intent: z.string(),
    model: z.string(),
    timestamp: z.string(),
  }),
});

export type WidgetSpec = z.infer<typeof WidgetSpecSchema>;
