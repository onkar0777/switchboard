import type { VerdictStatus } from "./types";

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
