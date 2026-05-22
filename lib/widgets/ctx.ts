import { mondayOfWeek, sundayEndOfWeek } from "@/lib/verdicts/engine";
import type { WidgetSpec } from "./spec";
import type { DslContext } from "./dsl/evaluate";

const DAY_MS = 24 * 60 * 60 * 1000;

// Reuses v1's engine week-math so the runtime's week boundaries are identical
// to computeVerdict's by construction — a precondition of the parity gate.
export function buildContext(spec: WidgetSpec, now: Date): DslContext {
  const weekStart = mondayOfWeek(now);
  const fourWeeksAgo = new Date(weekStart.getTime() - 21 * DAY_MS);
  return {
    now,
    nowMs: now.getTime(),
    weekStartIso: weekStart.toISOString(),
    weekEndIso: sundayEndOfWeek(now).toISOString(),
    fourWeeksAgoIso: fourWeeksAgo.toISOString(),
    ...spec.params,
  };
}
