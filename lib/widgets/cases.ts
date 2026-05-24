import { z } from "zod";

// What a golden `then` may assert. All optional except `state`: each case
// asserts the contract-defining fields it cares about as hand-written literals
// (targeted, not deep-equal). `slotIds` asserts the resolved render slot ids in
// order; `momentum` and `action` pin the rich verdict_card fields.
export const ThenSchema = z.object({
  state: z.enum(["ok", "loading", "error", "empty", "unauthorized"]),
  verdict: z.string().optional(),
  status: z.enum(["good", "at_risk", "behind", "neutral"]).optional(),
  value: z.union([z.number(), z.string(), z.null()]).optional(),
  slotIds: z.array(z.string()).optional(),
  momentum: z.array(z.number()).optional(),
  action: z.string().nullable().optional(),
});
export type ThenExpect = z.infer<typeof ThenSchema>;

// A data case: `given` rows keyed by MCP query name (spec.mcp.queries keys),
// executed in-memory via execute().
const DataCaseSchema = z.object({
  name: z.string().min(1),
  given: z.record(z.array(z.record(z.unknown()))),
  then: ThenSchema,
});

// A fault case: no rows; the loader is driven with a runner that throws the
// named fault, asserting the resulting failure `state`.
const FaultCaseSchema = z.object({
  name: z.string().min(1),
  fault: z.enum(["tool_error", "unauthorized"]),
  then: ThenSchema,
});

export const CaseSchema = z.union([DataCaseSchema, FaultCaseSchema]);
export type WidgetCase = z.infer<typeof CaseSchema>;

export const CasesSchema = z.object({
  schemaVersion: z.literal("1.0"),
  cases: z.array(CaseSchema).min(1),
});
export type WidgetCases = z.infer<typeof CasesSchema>;

// The required-case-set the widget template mandates (structure suite enforces
// presence by name). empty/happy/boundary/over-target are data cases;
// tool-error/unauthorized are fault cases.
export const REQUIRED_CASE_NAMES = [
  "empty",
  "happy",
  "boundary",
  "over-target",
  "tool-error",
  "unauthorized",
] as const;
