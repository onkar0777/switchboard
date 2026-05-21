import type { CanonicalStatus } from "./runtime";

// DESIGN.md "Color" + "Widget Grid — Emphasis Model": status bands carry the
// only saturated color on the page. emerald=good, amber=at_risk, rose=behind,
// ink/neutral=neutral. Applied by templates ONLY when state === "ok".
export const STATUS_TEXT: Record<CanonicalStatus, string> = {
  good: "text-emerald-700",
  at_risk: "text-amber-600",
  behind: "text-rose-700",
  neutral: "text-stone-900",
};

export const STATUS_RULE: Record<CanonicalStatus, string> = {
  good: "border-emerald-700",
  at_risk: "border-amber-600",
  behind: "border-rose-700",
  neutral: "border-stone-200",
};
