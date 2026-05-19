import type { VerdictStatus } from "./verdicts/types";

export const STATUS_TONE: Record<VerdictStatus, string> = {
  shipped: "text-emerald-700",
  on_track: "text-emerald-700",
  nearly_there: "text-amber-700",
  behind: "text-rose-700",
};

export const EYEBROW = "text-[11px] uppercase tracking-[0.12em] text-stone-600 font-medium";
