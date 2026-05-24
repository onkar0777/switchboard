import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { WidgetSpecSchema, type WidgetSpec } from "./spec";

// The anti empty-glob false-pass guard (structure suite AC1). Bump when a new
// widget is permanently added to the repo, so a vanished package fails loudly.
export const KNOWN_WIDGET_MIN = 1;

export interface WidgetPackage {
  name: string; // directory name, e.g. "founder-pr-verdict"
  dir: string; // absolute path to the package directory
  spec: WidgetSpec; // parsed + validated spec.json
}

// Discovers every widgets/<name>/spec.json from disk and validates each spec.
// A package is a directory under widgets/ that contains a spec.json. Loose
// root-level *.spec.json files (e.g. the live spec) are intentionally ignored —
// only the package shape participates in the generic suites.
export function discoverWidgetPackages(root: string = resolve(process.cwd(), "widgets")): WidgetPackage[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const pkgs: WidgetPackage[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = join(root, e.name);
    const specPath = join(dir, "spec.json");
    if (!existsSync(specPath)) continue;
    const spec = WidgetSpecSchema.parse(JSON.parse(readFileSync(specPath, "utf8")));
    pkgs.push({ name: e.name, dir, spec });
  }
  return pkgs;
}
