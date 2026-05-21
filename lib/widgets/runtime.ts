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
