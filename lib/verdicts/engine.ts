import type { GoalConfig, Receipt, VerdictStatus } from "./types";

export const DRAG_THRESHOLD_HOURS = 24;

export function pluralize(n: number, singular: string, plural?: string): string {
  if (n === 1) return singular;
  return plural ?? `${singular}s`;
}

export function statusFor(actual: number, target: number): VerdictStatus {
  if (target <= 0) return "behind";
  const ratio = actual / target;
  if (ratio >= 1.0) return "shipped";
  if (ratio >= 0.8) return "on_track";
  if (ratio >= 0.5) return "nearly_there";
  return "behind";
}

const PREFIX: Record<VerdictStatus, string> = {
  shipped: "Shipped",
  on_track: "On track",
  nearly_there: "Halfway",
  behind: "Behind",
};

export function headlineFor(
  status: VerdictStatus,
  goal: GoalConfig,
  actual: number,
  dragCount: number,
): string {
  const unitWord = pluralize(goal.target, goal.unit);
  let head = `${PREFIX[status]}: ${actual}/${goal.target} ${unitWord} this week.`;
  if (dragCount > 0) {
    const dragUnit = pluralize(dragCount, goal.unit);
    const verb = pluralize(dragCount, "is", "are");
    head += ` ${dragCount} ${dragUnit} ${verb} stale (waiting >${DRAG_THRESHOLD_HOURS}h).`;
  }
  return head;
}

export function pickMondayMove(drag: Receipt[], openPRs: Receipt[]): string | null {
  if (drag.length > 0) {
    const stalest = [...drag].sort(
      (a, b) => (b.hoursSinceUpdate ?? 0) - (a.hoursSinceUpdate ?? 0),
    )[0];
    const hours = Math.round(stalest.hoursSinceUpdate ?? 0);
    return `Unblock ${stalest.repo}#${stalest.prNumber} — stale ${hours}h.`;
  }
  if (openPRs.length > 0) {
    const newest = [...openPRs].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    )[0];
    const hours = Math.round(newest.hoursSinceUpdate ?? 0);
    return `Push ${newest.repo}#${newest.prNumber} — ${hours}h since you opened it.`;
  }
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function mondayOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = out.getUTCDay();
  const offsetToMonday = (dow + 6) % 7;
  out.setUTCDate(out.getUTCDate() - offsetToMonday);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

export function sundayEndOfWeek(d: Date): Date {
  const monday = mondayOfWeek(d);
  const sun = new Date(monday.getTime() + 6 * DAY_MS);
  sun.setUTCHours(23, 59, 59, 999);
  return sun;
}

export function bucketMomentum(merged: Receipt[], now: Date): number[] {
  const currentMonday = mondayOfWeek(now);
  const buckets = [0, 0, 0, 0];
  for (const pr of merged) {
    if (!pr.mergedAt) continue;
    const t = new Date(pr.mergedAt).getTime();
    for (let i = 0; i < 4; i++) {
      const start = new Date(currentMonday.getTime() - (3 - i) * 7 * DAY_MS);
      const end = new Date(start.getTime() + 7 * DAY_MS);
      if (t >= start.getTime() && t < end.getTime()) {
        buckets[i]++;
        break;
      }
    }
  }
  return buckets;
}
