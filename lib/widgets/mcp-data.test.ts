import { afterEach, describe, expect, it, vi } from "vitest";
import { parseToolResult, buildMcpData, BUDGET_MS } from "./mcp-data";
import { buildContext } from "./ctx";
import { WidgetSpecSchema } from "./spec";
import { McpBudgetError, McpDriftError } from "@/lib/mcp/errors";
import type { McpRunner } from "@/lib/mcp/client-manager";
import founderSpecJson from "@/widgets/founder-pr-verdict/spec.json";

const NOW = new Date("2026-05-06T12:00:00.000Z");

afterEach(() => {
  delete process.env.SWITCHBOARD_FORCE_MOCK;
  vi.useRealTimers();
});

describe("parseToolResult", () => {
  it("reads a top-level JSON array from text content", () => {
    expect(parseToolResult({ content: [{ type: "text", text: "[{\"id\":1}]" }] })).toEqual([{ id: 1 }]);
  });
  it("unwraps {items}/{rows}/{results}/{data}", () => {
    expect(parseToolResult({ content: [{ type: "text", text: "{\"items\":[{\"id\":2}]}" }] })).toEqual([{ id: 2 }]);
  });
  it("prefers structuredContent when present", () => {
    expect(parseToolResult({ structuredContent: [{ id: 3 }], content: [] })).toEqual([{ id: 3 }]);
  });
  it("returns [] for empty text", () => {
    expect(parseToolResult({ content: [{ type: "text", text: "" }] })).toEqual([]);
  });
  it("throws on non-JSON text", () => {
    expect(() => parseToolResult({ content: [{ type: "text", text: "not json" }] })).toThrow();
  });
});

describe("buildMcpData", () => {
  it("routes through the MockAdapter when SWITCHBOARD_FORCE_MOCK=1", async () => {
    process.env.SWITCHBOARD_FORCE_MOCK = "1";
    const spec = WidgetSpecSchema.parse(founderSpecJson);
    const data = await buildMcpData(spec, buildContext(spec, NOW));
    expect((data.queries.merged as unknown[]).length).toBe(16);
  });

  it("raises McpDriftError when a query's tool is no longer exposed", async () => {
    const spec = WidgetSpecSchema.parse(founderSpecJson);
    const runner: McpRunner = {
      listToolNames: async () => ["list_merged_prs"], // "list_open_prs" missing
      callTool: async () => [],
      close: async () => {},
    };
    await expect(buildMcpData(spec, buildContext(spec, NOW), { runner })).rejects.toBeInstanceOf(McpDriftError);
  });

  it("trips the aggregate budget and aborts in-flight queries", async () => {
    vi.useFakeTimers();
    const spec = WidgetSpecSchema.parse(founderSpecJson);
    const runner: McpRunner = {
      listToolNames: async () => ["list_merged_prs", "list_open_prs"],
      callTool: (_n, _a, opts) =>
        new Promise((_res, rej) => {
          opts?.signal?.addEventListener("abort", () => rej((opts.signal as AbortSignal).reason));
        }),
      close: async () => {},
    };
    const promise = buildMcpData(spec, buildContext(spec, NOW), { runner });
    const assertion = expect(promise).rejects.toBeInstanceOf(McpBudgetError);
    await vi.advanceTimersByTimeAsync(BUDGET_MS + 1);
    await assertion;
  });
});
