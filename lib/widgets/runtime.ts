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
