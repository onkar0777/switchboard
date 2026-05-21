export type CanonicalStatus = "good" | "at_risk" | "behind" | "neutral";
export type WidgetState = "ok" | "loading" | "error" | "empty" | "unauthorized";

// Decision 1 — fixed v1-band -> canonical-status table. Anchored to v1's
// on-screen colors (lib/design-tokens.ts STATUS_TONE). Any label not present
// here maps to "neutral" (safe default for non-numeric / no-target widgets).
const STATUS_MAP: Record<string, CanonicalStatus> = {
  shipped: "good",
  on_track: "good",
  nearly_there: "at_risk",
  behind: "behind",
};

export function mapStatus(band: string | undefined): CanonicalStatus {
  return (band !== undefined && STATUS_MAP[band]) || "neutral";
}

export interface DeeplinkConfig {
  template: string;
  fields: Record<string, string>;
}

export class DeeplinkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeeplinkValidationError";
  }
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function templateSlots(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

export function buildDeeplink(deeplink: DeeplinkConfig, row: Record<string, unknown>): string {
  return deeplink.template.replace(/\{(\w+)\}/g, (_m, slot: string) => {
    const fieldPath = deeplink.fields[slot];
    return fieldPath === undefined ? "" : String(getPath(row, fieldPath) ?? "");
  });
}

// Save-time-style validation: every template slot must have a field mapping,
// and every mapped field path must resolve on a representative row.
export function validateDeeplinkFields(deeplink: DeeplinkConfig, sampleRow: Record<string, unknown>): void {
  for (const slot of templateSlots(deeplink.template)) {
    if (!(slot in deeplink.fields)) {
      throw new DeeplinkValidationError(`deeplink template slot "{${slot}}" has no entry in deeplink.fields`);
    }
  }
  for (const [slot, fieldPath] of Object.entries(deeplink.fields)) {
    if (getPath(sampleRow, fieldPath) === undefined) {
      throw new DeeplinkValidationError(`deeplink field "${slot}" -> "${fieldPath}" does not resolve on the row shape`);
    }
  }
}

import { evaluate, type DslContext, type PipelineInput } from "./dsl/evaluate";
import type { Pipeline } from "./dsl/grammar";

export interface RuntimeOutput {
  verdict: string;
  value: number | string | null;
  status: CanonicalStatus;
  state: WidgetState;
  rows: Array<Record<string, unknown> & { deeplink: string }>;
  slots: Record<string, unknown>;
  momentum?: number[];
}

interface ExecutableSpec {
  verdict: { pipeline: Pipeline };
  deeplink: DeeplinkConfig;
  render: { slots: Record<string, unknown> };
}

// Pure: runs the verdict pipeline, derives canonical status, builds per-row
// deeplinks. No I/O — `data` is supplied by the fixture builder (Steps 2-3) or
// the MCP client-manager (Step 4). State is "ok" here; failure states are set
// by the caller (load-widget / data route) when a query or validation fails.
export function execute(spec: ExecutableSpec, data: PipelineInput, ctx: DslContext): RuntimeOutput {
  const bag = evaluate(spec.verdict.pipeline, data, ctx);

  const rowSourceName = (spec.render.slots.from as string | undefined) ?? "receipts";
  const rawRows = Array.isArray(bag[rowSourceName]) ? (bag[rowSourceName] as Record<string, unknown>[]) : [];
  const rows = rawRows.map((row) => ({ ...row, deeplink: buildDeeplink(spec.deeplink, row) }));

  const slots: Record<string, unknown> = {};
  for (const [slot, source] of Object.entries(spec.render.slots)) {
    if (slot === "from") continue;
    slots[slot] = typeof source === "string" ? bag[source] : source;
  }

  const value = (bag.value as number | string | undefined) ?? null;
  const verdict = typeof bag.verdict === "string" ? bag.verdict : "";

  return {
    verdict,
    value,
    status: mapStatus(bag.statusBand as string | undefined),
    state: "ok",
    rows,
    slots,
    momentum: Array.isArray(bag.momentum) ? (bag.momentum as number[]) : undefined,
  };
}
