import { mondayOfWeek, sundayEndOfWeek } from "./week";
import type { WidgetSpec } from "./spec";
import type { DslContext } from "./dsl/evaluate";

const DAY_MS = 24 * 60 * 60 * 1000;

// Week-boundary math (lib/widgets/week.ts) is the authoritative source for the
// runtime's week window — the verdict pipeline filters merged PRs against it.
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
