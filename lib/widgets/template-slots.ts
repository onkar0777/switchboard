import { z } from "zod";

// A deeplinked, rankable row. deeplink is optional because slot rows (from the
// DSL bag) may not carry it — output.rows is the deeplinked source for lists.
export const RowSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    deeplink: z.string().optional(),
  })
  .passthrough();

const VerdictCardSlots = z
  .object({
    verdict: z.string(),
    receipts: z.array(RowSchema).optional(),
    drag: z.array(RowSchema).optional(),
    momentum: z.array(z.number()).optional(),
    action: z.string().nullable().optional(),
  })
  .passthrough();

// All fields optional by design: the scoreboard template falls back to top-level
// output fields (verdict/value) when a slot is absent (plan D4). validateSlots
// enforces shape only, not semantic completeness — `{}` is a structurally valid
// (if blank) scoreboard, not a validation error.
const ScoreboardSlots = z
  .object({
    headline: z.string().optional(),
    value: z.union([z.number(), z.string()]).optional(),
    deltaPct: z.number().optional(),
  })
  .passthrough();

const ListSlots = z
  .object({
    verdict: z.string(),
    rows: z.array(RowSchema).optional(),
  })
  .passthrough();

const SingleStatSlots = z
  .object({
    value: z.union([z.number(), z.string()]),
    label: z.string(),
    verdict: z.string().optional(),
  })
  .passthrough();

const SCHEMAS = {
  verdict_card: VerdictCardSlots,
  scoreboard: ScoreboardSlots,
  list: ListSlots,
  single_stat: SingleStatSlots,
} as const;

export type TemplateName = keyof typeof SCHEMAS;

export class SlotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotValidationError";
  }
}

// Validates a template's resolved render slots. Throws SlotValidationError on
// a mismatch (the loader turns this into state:"error").
export function validateSlots(template: TemplateName, slots: Record<string, unknown>): void {
  const res = SCHEMAS[template].safeParse(slots);
  if (!res.success) throw new SlotValidationError(`slots invalid for "${template}": ${res.error.message}`);
}
